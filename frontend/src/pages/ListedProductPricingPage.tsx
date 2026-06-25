import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calculator,
  Database,
  PackageSearch,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  CurrencyRecord,
  ListedProduct,
  ListedProductPricingPayload,
  ListedProductPricingRecord,
  ListedProductVariant,
  PricingCalculatePayload,
  PricingCalculateResult,
  calculatePricing,
  createListedProductPricingRecord,
  deleteListedProductPricingRecord,
  fetchCurrencies,
  fetchListedProductPricingRecords,
  fetchListedProducts,
} from "../lib/api";
import { useToast } from "../lib/toast-context";
import { cn, formatCurrency, formatDate, safeDisplay } from "../lib/utils";

const inputClass =
  "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring";
const textareaClass =
  "min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-ring";

const blankCalculatorForm = {
  cost_template: "none",
  item_cost: "0",
  product_weight: "1",
  source_currency: "USD",
  target_currency: "MVR",
  origin_country: "Malaysia",
  destination_country: "Maldives",
  desired_margin_percent: "25",
  payment_fee_percent: "0",
  customs_cost: "0",
  local_delivery_cost: "0",
  packaging_cost: "0",
  other_cost: "0",
  notes: "",
};

type PricingTarget = {
  product: ListedProduct;
  variant: ListedProductVariant | null;
  scope: "all_variants" | "variant";
};

function numberFrom(value: string) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function toNumber(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function roundedPrice(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.ceil(value);
}

function activeCurrencyCodes(currencies: CurrencyRecord[]) {
  const codes = currencies.filter((currency) => currency.is_active).map((currency) => currency.code);
  return codes.length ? codes : ["MVR", "USD"];
}

function latestRecordFor(
  records: ListedProductPricingRecord[],
  productId: string,
  variantId?: string | null,
) {
  return records.find((record) => {
    if (record.product_id !== productId) {
      return false;
    }
    if (variantId) {
      return record.variant_id === variantId;
    }
    return record.pricing_scope === "all_variants" && !record.variant_id;
  });
}

export function ListedProductPricingPage() {
  const { notify } = useToast();
  const [products, setProducts] = useState<ListedProduct[]>([]);
  const [records, setRecords] = useState<ListedProductPricingRecord[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyRecord[]>([]);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [expandedProductIds, setExpandedProductIds] = useState<string[]>([]);
  const [pricingModes, setPricingModes] = useState<Record<string, "all_variants" | "variant">>({});
  const [calculatorTarget, setCalculatorTarget] = useState<PricingTarget | null>(null);
  const [form, setForm] = useState(blankCalculatorForm);
  const [calculation, setCalculation] = useState<PricingCalculateResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [productResponse, savedRecords, activeCurrencies] = await Promise.all([
        fetchListedProducts({ search: query }),
        fetchListedProductPricingRecords(),
        fetchCurrencies({ includeInactive: false }),
      ]);
      setProducts(productResponse.items);
      setRecords(savedRecords);
      setCurrencies(activeCurrencies);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to load listed products.";
      setError(message);
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  }, [notify, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const currencyCodes = useMemo(() => activeCurrencyCodes(currencies), [currencies]);
  const summary = useMemo(() => {
    const variantCount = products.reduce((total, product) => total + product.variants.length, 0);
    const pricedProductCount = new Set(records.map((record) => record.product_id)).size;
    return {
      products: products.length,
      variants: variantCount,
      savedRecords: records.length,
      pricedProducts: pricedProductCount,
    };
  }, [products, records]);

  function setPricingMode(productId: string, mode: "all_variants" | "variant") {
    setPricingModes((current) => ({ ...current, [productId]: mode }));
  }

  function productMode(product: ListedProduct) {
    return pricingModes[product.id] || "all_variants";
  }

  function toggleProduct(productId: string) {
    setExpandedProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  }

  function openCalculator(target: PricingTarget) {
    const baseCurrency = currencyCodes.includes("MVR") ? "MVR" : currencyCodes[0] || "MVR";
    const sourceCurrency = currencyCodes.includes("USD") ? "USD" : currencyCodes[0] || baseCurrency;
    setCalculatorTarget(target);
    setCalculation(null);
    setModalError("");
    setForm({
      ...blankCalculatorForm,
      item_cost: target.variant?.price ? String(target.variant.price) : blankCalculatorForm.item_cost,
      source_currency: sourceCurrency,
      target_currency: baseCurrency,
      payment_fee_percent: "0",
    });
  }

  function updateForm(key: keyof typeof blankCalculatorForm, value: string) {
    if (key === "cost_template") {
      setForm((current) => ({
        ...current,
        cost_template: value,
        payment_fee_percent: value === "bml" ? "3" : current.payment_fee_percent,
      }));
      return;
    }
    setForm((current) => ({ ...current, [key]: value }));
  }

  function buildPayload(): PricingCalculatePayload {
    return {
      item_cost: numberFrom(form.item_cost),
      source_currency: form.source_currency.toUpperCase(),
      target_currency: form.target_currency.toUpperCase(),
      product_weight: numberFrom(form.product_weight),
      origin_country: form.origin_country,
      destination_country: form.destination_country,
      desired_margin_percent: numberFrom(form.desired_margin_percent),
      payment_fee_percent: numberFrom(form.payment_fee_percent),
      customs_cost: numberFrom(form.customs_cost),
      local_delivery_cost: numberFrom(form.local_delivery_cost),
      packaging_cost: numberFrom(form.packaging_cost),
      other_cost: numberFrom(form.other_cost),
    };
  }

  async function submitCalculation(event: FormEvent) {
    event.preventDefault();
    setCalculating(true);
    setModalError("");
    try {
      const result = await calculatePricing(buildPayload());
      setCalculation(result);
      notify("Listed product price calculated.", "success");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to calculate price.";
      setCalculation(null);
      setModalError(message);
      notify(message, "error");
    } finally {
      setCalculating(false);
    }
  }

  async function saveCalculation() {
    if (!calculation || !calculatorTarget) {
      return;
    }
    setSaving(true);
    setModalError("");
    const target = calculatorTarget;
    const finalPrice = roundedPrice(toNumber(calculation.recommended_sale_price));
    const inputSnapshot = {
      ...buildPayload(),
      cost_template: form.cost_template,
      notes: form.notes,
    };
    const resultSnapshot = {
      ...calculation,
      final_rounded_price: finalPrice,
    };
    const payload: ListedProductPricingPayload = {
      product_id: target.product.id,
      product_legacy_id: target.product.legacyResourceId,
      product_title: target.product.title,
      product_handle: target.product.handle,
      product_image_url: target.product.imageUrl,
      variant_id: target.variant?.id || null,
      variant_legacy_id: target.variant?.legacyResourceId || null,
      variant_title: target.variant?.title || null,
      variant_sku: target.variant?.sku || null,
      pricing_scope: target.scope,
      source_currency: calculation.source_currency,
      target_currency: calculation.target_currency,
      item_cost: numberFrom(form.item_cost),
      product_weight: numberFrom(form.product_weight),
      desired_margin_percent: numberFrom(form.desired_margin_percent),
      payment_fee_percent: numberFrom(form.payment_fee_percent),
      total_landed_cost: toNumber(calculation.total_landed_cost),
      payment_fee_amount: toNumber(calculation.payment_fee),
      expected_profit: toNumber(calculation.expected_profit),
      recommended_sale_price: toNumber(calculation.recommended_sale_price),
      final_rounded_price: finalPrice,
      input_snapshot: inputSnapshot,
      result_snapshot: resultSnapshot,
    };
    try {
      const saved = await createListedProductPricingRecord(payload);
      setRecords((current) => [saved, ...current]);
      notify("Listed product pricing saved.", "success");
      setCalculatorTarget(null);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to save listed product pricing.";
      setModalError(message);
      notify(message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(record: ListedProductPricingRecord) {
    if (!window.confirm(`Delete saved pricing for ${record.product_title}?`)) {
      return;
    }
    try {
      await deleteListedProductPricingRecord(record.id);
      setRecords((current) => current.filter((item) => item.id !== record.id));
      notify("Pricing record deleted.", "success");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to delete pricing record.";
      notify(message, "error");
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Listed Product Pricing</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Calculate suggested prices for Shopify-listed products without changing storefront prices.
          </p>
        </div>
        <Button disabled={loading} variant="outline" onClick={load}>
          <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh products
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="Products loaded" value={summary.products} />
        <SummaryCard label="Variants visible" value={summary.variants} />
        <SummaryCard label="Saved records" value={summary.savedRecords} />
        <SummaryCard label="Priced products" value={summary.pricedProducts} />
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[1fr_auto_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={cn(inputClass, "pl-9")}
              placeholder="Search products, handles, variants, or SKU..."
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setQuery(queryInput);
                }
              }}
            />
          </label>
          <Button variant="outline" onClick={() => setQuery(queryInput)}>
            Search
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setQueryInput("");
              setQuery("");
            }}
          >
            Clear
          </Button>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-orange-700 dark:text-orange-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b p-4">
          <CardTitle>Shopify listed products</CardTitle>
          <Badge variant="muted">{products.length} products</Badge>
        </CardHeader>
        {loading ? (
          <CardContent className="space-y-3 p-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-md bg-muted" />
            ))}
          </CardContent>
        ) : products.length === 0 ? (
          <CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center">
            <PackageSearch className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No products found</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Check the dashboard API token, configured shop domain, or product search.
            </p>
          </CardContent>
        ) : (
          <div className="divide-y">
            {products.map((product) => {
              const isExpanded = expandedProductIds.includes(product.id);
              const mode = productMode(product);
              const latestAllRecord = latestRecordFor(records, product.id);
              return (
                <div key={product.id} className="p-4">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <button
                      className="flex min-w-0 items-center gap-3 text-left"
                      type="button"
                      onClick={() => toggleProduct(product.id)}
                    >
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                        {product.imageUrl ? (
                          <img
                            alt={product.imageAlt || product.title}
                            className="h-full w-full object-cover"
                            src={product.imageUrl}
                          />
                        ) : (
                          <Database className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold">{product.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">/{product.handle || "no-handle"}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{product.variants.length} variants</span>
                          <span>•</span>
                          <span>{product.mediaCount} images</span>
                          <span>•</span>
                          <span>{product.galleryCount} galleries</span>
                        </div>
                      </div>
                    </button>
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      {latestAllRecord ? (
                        <Badge variant="success">
                          {formatCurrency(latestAllRecord.final_rounded_price, latestAllRecord.target_currency)}
                        </Badge>
                      ) : (
                        <Badge variant="muted">No saved price</Badge>
                      )}
                      <select
                        className={cn(inputClass, "w-auto min-w-48")}
                        value={mode}
                        onChange={(event) => setPricingMode(product.id, event.target.value as "all_variants" | "variant")}
                      >
                        <option value="all_variants">One price for all variants</option>
                        <option value="variant">Separate price per variant</option>
                      </select>
                      <Button
                        onClick={() =>
                          openCalculator({
                            product,
                            variant: null,
                            scope: "all_variants",
                          })
                        }
                      >
                        <Calculator className="h-4 w-4" />
                        Calculate Price
                      </Button>
                      <Button variant="outline" onClick={() => toggleProduct(product.id)}>
                        {isExpanded ? "Hide variants" : "View variants"}
                      </Button>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="mt-4 overflow-hidden rounded-lg border">
                      <div className="grid grid-cols-[minmax(260px,1fr)_120px_150px_180px] gap-3 border-b bg-muted/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <span>Variant</span>
                        <span>Shopify price</span>
                        <span>Saved price</span>
                        <span className="text-right">Action</span>
                      </div>
                      {product.variants.map((variant) => {
                        const latestVariantRecord = latestRecordFor(records, product.id, variant.id);
                        return (
                          <div
                            key={variant.id}
                            className="grid grid-cols-[minmax(260px,1fr)_120px_150px_180px] items-center gap-3 border-b px-4 py-3 last:border-b-0"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{variant.title}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                SKU {safeDisplay(variant.sku)} · ID {safeDisplay(variant.legacyResourceId)}
                              </p>
                            </div>
                            <span className="text-sm font-medium">{variant.price ? formatCurrency(Number(variant.price), "MVR") : "--"}</span>
                            <span className="text-sm font-medium">
                              {latestVariantRecord
                                ? formatCurrency(latestVariantRecord.final_rounded_price, latestVariantRecord.target_currency)
                                : "--"}
                            </span>
                            <div className="flex justify-end">
                              <Button
                                disabled={mode !== "variant"}
                                size="sm"
                                variant={mode === "variant" ? "default" : "outline"}
                                onClick={() =>
                                  openCalculator({
                                    product,
                                    variant,
                                    scope: "variant",
                                  })
                                }
                              >
                                Calculate
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b p-4">
          <CardTitle>Saved pricing records</CardTitle>
          <Badge variant="muted">{records.length} saved</Badge>
        </CardHeader>
        {records.length === 0 ? (
          <CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 p-6 text-center">
            <Database className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-medium">No saved listed product prices yet</p>
          </CardContent>
        ) : (
          <div className="divide-y">
            {records.slice(0, 20).map((record) => (
              <div key={record.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_150px_150px_auto] md:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{record.product_title}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {record.pricing_scope === "variant" ? record.variant_title || "Variant price" : "One price for all variants"} · saved {formatDate(record.updated_at)}
                  </p>
                </div>
                <Metric label="Final price" value={formatCurrency(record.final_rounded_price, record.target_currency)} />
                <Metric label="Profit" value={formatCurrency(record.expected_profit, record.target_currency)} />
                <div className="flex justify-end">
                  <Button aria-label="Delete pricing record" size="icon" variant="ghost" onClick={() => deleteRecord(record)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {calculatorTarget ? (
        <CalculatorModal
          calculation={calculation}
          calculating={calculating}
          currencyCodes={currencyCodes}
          error={modalError}
          form={form}
          saving={saving}
          target={calculatorTarget}
          onCalculate={submitCalculation}
          onClose={() => setCalculatorTarget(null)}
          onSave={saveCalculation}
          onUpdate={updateForm}
        />
      ) : null}
    </div>
  );
}

function CalculatorModal({
  calculation,
  calculating,
  currencyCodes,
  error,
  form,
  saving,
  target,
  onCalculate,
  onClose,
  onSave,
  onUpdate,
}: {
  calculation: PricingCalculateResult | null;
  calculating: boolean;
  currencyCodes: string[];
  error: string;
  form: typeof blankCalculatorForm;
  saving: boolean;
  target: PricingTarget;
  onCalculate: (event: FormEvent) => void;
  onClose: () => void;
  onSave: () => void;
  onUpdate: (key: keyof typeof blankCalculatorForm, value: string) => void;
}) {
  const finalPrice = calculation ? roundedPrice(toNumber(calculation.recommended_sale_price)) : 0;
  const targetLabel = target.variant ? `${target.product.title} · ${target.variant.title}` : target.product.title;
  const targetCurrency = calculation?.target_currency || form.target_currency;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-md sm:items-center">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-xl border bg-card shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-card p-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Listed product calculator
            </p>
            <h3 className="mt-1 truncate text-lg font-semibold">{targetLabel}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              This saves a dashboard pricing record only. Shopify prices are not changed.
            </p>
          </div>
          <Button aria-label="Close calculator" size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-5 p-5 xl:grid-cols-[1.05fr_0.95fr]">
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onCalculate}>
            {error ? (
              <div className="rounded-md border border-orange-500/30 bg-orange-500/5 p-3 text-sm text-orange-700 dark:text-orange-300 sm:col-span-2">
                {error}
              </div>
            ) : null}
            <Field label="Cost template">
              <select
                className={inputClass}
                value={form.cost_template}
                onChange={(event) => onUpdate("cost_template", event.target.value)}
              >
                <option value="none">No template</option>
                <option value="bml">BML</option>
              </select>
            </Field>
            <Field label="Item cost">
              <input required className={inputClass} min="0" step="0.01" type="number" value={form.item_cost} onChange={(event) => onUpdate("item_cost", event.target.value)} />
            </Field>
            <Field label="Product weight kg">
              <input required className={inputClass} min="0.001" step="0.001" type="number" value={form.product_weight} onChange={(event) => onUpdate("product_weight", event.target.value)} />
            </Field>
            <Field label="Source currency">
              <CurrencySelect codes={currencyCodes} value={form.source_currency} onChange={(value) => onUpdate("source_currency", value)} />
            </Field>
            <Field label="Target currency">
              <CurrencySelect codes={currencyCodes} value={form.target_currency} onChange={(value) => onUpdate("target_currency", value)} />
            </Field>
            <Field label="Origin country">
              <input required className={inputClass} value={form.origin_country} onChange={(event) => onUpdate("origin_country", event.target.value)} />
            </Field>
            <Field label="Destination country">
              <input required className={inputClass} value={form.destination_country} onChange={(event) => onUpdate("destination_country", event.target.value)} />
            </Field>
            <Field label="Desired margin %">
              <input required className={inputClass} max="99" min="0" step="0.01" type="number" value={form.desired_margin_percent} onChange={(event) => onUpdate("desired_margin_percent", event.target.value)} />
            </Field>
            <Field label="Payment fee %">
              <input required className={inputClass} max="99" min="0" step="0.01" type="number" value={form.payment_fee_percent} onChange={(event) => onUpdate("payment_fee_percent", event.target.value)} />
            </Field>
            <Field label="Customs MVR">
              <input className={inputClass} min="0" step="0.01" type="number" value={form.customs_cost} onChange={(event) => onUpdate("customs_cost", event.target.value)} />
            </Field>
            <Field label="Local delivery MVR">
              <input className={inputClass} min="0" step="0.01" type="number" value={form.local_delivery_cost} onChange={(event) => onUpdate("local_delivery_cost", event.target.value)} />
            </Field>
            <Field label="Packaging MVR">
              <input className={inputClass} min="0" step="0.01" type="number" value={form.packaging_cost} onChange={(event) => onUpdate("packaging_cost", event.target.value)} />
            </Field>
            <Field label="Other MVR">
              <input className={inputClass} min="0" step="0.01" type="number" value={form.other_cost} onChange={(event) => onUpdate("other_cost", event.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes">
                <textarea className={textareaClass} value={form.notes} onChange={(event) => onUpdate("notes", event.target.value)} />
              </Field>
            </div>
            <div className="flex justify-end sm:col-span-2">
              <Button disabled={calculating} type="submit">
                <Calculator className="h-4 w-4" />
                {calculating ? "Calculating..." : "Calculate price"}
              </Button>
            </div>
          </form>

          <div className="space-y-4">
            {calculation ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ResultCard label="Landed cost" value={formatCurrency(calculation.total_landed_cost, targetCurrency)} />
                  <ResultCard label="Payment fee" value={formatCurrency(calculation.payment_fee, targetCurrency)} />
                  <ResultCard label="Profit" value={formatCurrency(calculation.expected_profit, targetCurrency)} />
                  <ResultCard label="Recommended" value={formatCurrency(calculation.recommended_sale_price, targetCurrency)} />
                </div>
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Final rounded price
                      </p>
                      <p className="mt-1 text-2xl font-bold">{formatCurrency(finalPrice, targetCurrency)}</p>
                    </div>
                    <Button disabled={saving} onClick={onSave}>
                      <Save className="h-4 w-4" />
                      {saving ? "Saving..." : "Save pricing"}
                    </Button>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center">
                  <Calculator className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Calculate to preview a selling price</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    The result will be stored as a listed-product pricing record only after you press Save.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function CurrencySelect({
  codes,
  value,
  onChange,
}: {
  codes: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
      {codes.map((code) => (
        <option key={code} value={code}>
          {code}
        </option>
      ))}
    </select>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function ResultCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-2 break-words text-lg font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
