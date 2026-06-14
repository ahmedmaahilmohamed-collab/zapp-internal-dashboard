import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Calculator, CheckCircle2, PackageCheck, RefreshCcw, Save } from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  CostPayload,
  CostTemplateRecord,
  CurrencyRecord,
  PricingCalculatePayload,
  PricingCalculateResult,
  calculatePricing,
  createCost,
  fetchCostTemplates,
  fetchCurrencies,
} from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useToast } from "../lib/toast-context";
import { cn, formatCurrency, safeDisplay } from "../lib/utils";

const inputClass =
  "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring";
const textareaClass =
  "min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-ring";

const blankForm = {
  item_cost: "100",
  source_currency: "USD",
  target_currency: "MVR",
  product_weight: "2",
  origin_country: "Malaysia",
  destination_country: "Maldives",
  desired_margin_percent: "25",
  payment_fee_percent: "3",
  template_bml_tax: "0",
  customs_cost: "0",
  local_delivery_cost: "0",
  packaging_cost: "0",
  other_cost: "0",
  reference_label: "",
  linked_order_id: "",
  linked_request_id: "",
  notes: "",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function numberFrom(value: string) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function toNumber(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

export function CalculatorPage() {
  const { canManageFinance } = useAuth();
  const { notify } = useToast();
  const [currencies, setCurrencies] = useState<CurrencyRecord[]>([]);
  const [templates, setTemplates] = useState<CostTemplateRecord[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [form, setForm] = useState(blankForm);
  const [result, setResult] = useState<PricingCalculateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const loadSetup = useCallback(async () => {
    try {
      const [activeCurrencies, activeTemplates] = await Promise.all([
        fetchCurrencies({ includeInactive: false }),
        fetchCostTemplates({ includeInactive: false }),
      ]);
      setCurrencies(activeCurrencies);
      setTemplates(activeTemplates);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to load calculator setup.";
      setError(message);
      notify(message, "error");
    }
  }, [notify]);

  useEffect(() => {
    void loadSetup();
  }, [loadSetup]);

  const activeCodes = useMemo(() => {
    const codes = currencies.map((currency) => currency.code);
    return codes.length > 0 ? codes : ["MVR", "USD"];
  }, [currencies]);

  function updateField(key: keyof typeof blankForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaveMessage("");
  }

  function applyTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    const template = templates.find((item) => String(item.id) === templateId);
    if (!template) {
      return;
    }
    setForm((current) => ({
      ...current,
      target_currency: activeCodes.includes(template.currency) ? template.currency : current.target_currency,
      desired_margin_percent: String(template.default_margin_percent),
      template_bml_tax: String(template.default_bml_tax),
      customs_cost: String(template.default_import_tax),
      local_delivery_cost: String(template.default_shipping_cost),
      other_cost: String(template.default_additional_cost),
    }));
    setSaveMessage("");
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

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSaveMessage("");

    try {
      setResult(await calculatePricing(buildPayload()));
      notify("Pricing calculated.", "success");
    } catch (caught) {
      setResult(null);
      const message = caught instanceof Error ? caught.message : "Unable to calculate pricing.";
      setError(message);
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function saveAsCostRecord() {
    if (!result || !canManageFinance) {
      return;
    }

    setSaving(true);
    setError("");
    setSaveMessage("");

    const sourceType = form.linked_order_id ? "order" : form.linked_request_id ? "request" : "manual";
    const sourceId = form.linked_order_id || form.linked_request_id || null;
    const payload: CostPayload = {
      source_type: sourceType,
      source_id: sourceId,
      linked_order_id: form.linked_order_id || null,
      linked_request_id: form.linked_request_id || null,
      reference_label:
        form.reference_label ||
        `Calculator estimate: ${form.origin_country} to ${form.destination_country}`,
      title: "Pricing calculator estimate",
      product_purchase_cost: toNumber(result.converted_item_cost),
      bml_tax: toNumber(result.payment_fee) + numberFrom(form.template_bml_tax),
      import_tax: toNumber(result.customs_cost),
      shipping_cost:
        toNumber(result.international_shipping_cost) + toNumber(result.local_delivery_cost),
      additional_cost: toNumber(result.packaging_cost) + toNumber(result.other_cost),
      sale_total: toNumber(result.recommended_sale_price),
      currency: result.target_currency,
      notes: form.notes || null,
    };

    try {
      const saved = await createCost(payload);
      setSaveMessage(`Saved cost record #${saved.id}.`);
      notify("Cost record saved.", "success");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to save cost record.";
      setError(message);
      notify(message, "error");
    } finally {
      setSaving(false);
    }
  }

  const targetCurrency = result?.target_currency || form.target_currency || "MVR";

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Calculator</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Estimate landed cost, sale price, and margin from currencies and shipping rates.
          </p>
        </div>
        <Button variant="outline" onClick={loadSetup}>
          <RefreshCcw className="h-4 w-4" />
          Refresh rates
        </Button>
      </div>

      {error ? (
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-orange-700 dark:text-orange-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader className="border-b p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Calculator className="h-5 w-5" />
              </div>
              <CardTitle>Pricing Inputs</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
              <div className="sm:col-span-2">
                <Field label="Cost template">
                  <select className={inputClass} value={selectedTemplateId} onChange={(event) => applyTemplate(event.target.value)}>
                    <option value="">No template</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} ({template.currency})
                      </option>
                    ))}
                  </select>
                </Field>
                <p className="mt-1 text-xs text-muted-foreground">
                  Template BML tax is added when saving the calculation as a cost record.
                </p>
              </div>
              <Field label="Item cost">
                <input
                  required
                  className={inputClass}
                  min="0"
                  step="0.01"
                  type="number"
                  value={form.item_cost}
                  onChange={(event) => updateField("item_cost", event.target.value)}
                />
              </Field>
              <Field label="Product weight (kg)">
                <input
                  required
                  className={inputClass}
                  min="0.001"
                  step="0.001"
                  type="number"
                  value={form.product_weight}
                  onChange={(event) => updateField("product_weight", event.target.value)}
                />
              </Field>
              <Field label="Source currency">
                <select
                  className={inputClass}
                  value={form.source_currency}
                  onChange={(event) => updateField("source_currency", event.target.value)}
                >
                  {activeCodes.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Target currency">
                <select
                  className={inputClass}
                  value={form.target_currency}
                  onChange={(event) => updateField("target_currency", event.target.value)}
                >
                  {activeCodes.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Origin country">
                <input
                  required
                  className={inputClass}
                  value={form.origin_country}
                  onChange={(event) => updateField("origin_country", event.target.value)}
                />
              </Field>
              <Field label="Destination country">
                <input
                  required
                  className={inputClass}
                  value={form.destination_country}
                  onChange={(event) => updateField("destination_country", event.target.value)}
                />
              </Field>
              <Field label="Desired margin %">
                <input
                  required
                  className={inputClass}
                  min="0"
                  max="99"
                  step="0.01"
                  type="number"
                  value={form.desired_margin_percent}
                  onChange={(event) => updateField("desired_margin_percent", event.target.value)}
                />
              </Field>
              <Field label="Payment fee %">
                <input
                  className={inputClass}
                  min="0"
                  max="99"
                  step="0.01"
                  type="number"
                  value={form.payment_fee_percent}
                  onChange={(event) => updateField("payment_fee_percent", event.target.value)}
                />
              </Field>
              <Field label={`Customs (${form.target_currency})`}>
                <input className={inputClass} min="0" step="0.01" type="number" value={form.customs_cost} onChange={(event) => updateField("customs_cost", event.target.value)} />
              </Field>
              <Field label={`Local delivery (${form.target_currency})`}>
                <input className={inputClass} min="0" step="0.01" type="number" value={form.local_delivery_cost} onChange={(event) => updateField("local_delivery_cost", event.target.value)} />
              </Field>
              <Field label={`Packaging (${form.target_currency})`}>
                <input className={inputClass} min="0" step="0.01" type="number" value={form.packaging_cost} onChange={(event) => updateField("packaging_cost", event.target.value)} />
              </Field>
              <Field label={`Other (${form.target_currency})`}>
                <input className={inputClass} min="0" step="0.01" type="number" value={form.other_cost} onChange={(event) => updateField("other_cost", event.target.value)} />
              </Field>

              {canManageFinance ? (
                <>
                  <div className="border-t pt-4 sm:col-span-2">
                    <p className="text-sm font-semibold">Optional save details</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Used only if you save the result as an internal cost record.
                    </p>
                  </div>
                  <Field label="Reference label">
                    <input className={inputClass} value={form.reference_label} onChange={(event) => updateField("reference_label", event.target.value)} />
                  </Field>
                  <Field label="Linked order ID">
                    <input className={inputClass} value={form.linked_order_id} onChange={(event) => updateField("linked_order_id", event.target.value)} />
                  </Field>
                  <Field label="Linked request ID">
                    <input className={inputClass} value={form.linked_request_id} onChange={(event) => updateField("linked_request_id", event.target.value)} />
                  </Field>
                  <Field label="Notes">
                    <textarea className={textareaClass} value={form.notes} onChange={(event) => updateField("notes", event.target.value)} />
                  </Field>
                </>
              ) : null}
              <div className="flex justify-end sm:col-span-2">
                <Button disabled={loading} type="submit">
                  {loading ? "Calculating..." : "Calculate"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-5">
          {!result && !loading ? (
            <Card>
              <CardContent className="flex min-h-80 flex-col items-center justify-center gap-3 p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <PackageCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium">No calculation yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Fill the inputs and calculate to see landed cost and sale price.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {loading ? (
            <Card>
              <CardContent className="space-y-3 p-4">
                {[0, 1, 2, 3].map((item) => (
                  <div key={item} className="h-16 animate-pulse rounded-md bg-muted" />
                ))}
              </CardContent>
            </Card>
          ) : null}

          {result ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <ResultCard
                  label="Landed cost"
                  value={formatCurrency(toNumber(result.total_landed_cost), targetCurrency)}
                />
                <ResultCard
                  label="Sale price"
                  value={formatCurrency(toNumber(result.recommended_sale_price), targetCurrency)}
                  highlight
                />
                <ResultCard
                  label="Profit"
                  value={formatCurrency(toNumber(result.expected_profit), targetCurrency)}
                  tone="profit"
                />
                <ResultCard
                  label="Margin"
                  value={result.margin_percent === null ? "--" : `${Number(result.margin_percent).toFixed(2)}%`}
                />
              </div>

              <Card>
                <CardHeader className="border-b p-4">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>Breakdown</CardTitle>
                    <Badge variant="muted">{targetCurrency}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  {[
                    ["Converted item cost", result.converted_item_cost],
                    ["International shipping", result.international_shipping_cost],
                    ["Customs", result.customs_cost],
                    ["Local delivery", result.local_delivery_cost],
                    ["Packaging", result.packaging_cost],
                    ["Other", result.other_cost],
                    ["Payment fee", result.payment_fee],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex items-center justify-between gap-3 rounded-md bg-muted/30 p-3 text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{formatCurrency(toNumber(value), targetCurrency)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b p-4">
                  <CardTitle>Shipping Rate Used</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
                  <Info label="Name" value={result.shipping_rate_used.name} />
                  <Info label="Carrier" value={result.shipping_rate_used.carrier} />
                  <Info
                    label="Route"
                    value={`${result.shipping_rate_used.origin_country} to ${result.shipping_rate_used.destination_country}`}
                  />
                  <Info
                    label="Weight band"
                    value={`${result.shipping_rate_used.min_weight}-${result.shipping_rate_used.max_weight} kg`}
                  />
                  <Info
                    label="Rate"
                    value={`${formatCurrency(toNumber(result.shipping_rate_used.rate), result.shipping_rate_used.currency)}/kg`}
                  />
                  <Info
                    label="ETA"
                    value={`${safeDisplay(result.shipping_rate_used.estimated_days_min)}-${safeDisplay(
                      result.shipping_rate_used.estimated_days_max,
                    )} days`}
                  />
                </CardContent>
              </Card>

              {canManageFinance ? (
                <Card>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">Save as internal cost record</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Creates a finance record using this recommended sale price.
                      </p>
                      {saveMessage ? (
                        <p className="mt-2 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          {saveMessage}
                        </p>
                      ) : null}
                    </div>
                    <Button disabled={saving} onClick={saveAsCostRecord}>
                      <Save className="h-4 w-4" />
                      {saving ? "Saving..." : "Save Record"}
                    </Button>
                  </CardContent>
                </Card>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ResultCard({
  label,
  value,
  highlight = false,
  tone,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  tone?: "profit";
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-2 text-2xl font-bold",
            highlight && "text-primary",
            tone === "profit" && "text-emerald-600 dark:text-emerald-400",
          )}
        >
          {value}
        </p>
      </CardContent>
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-primary/60 to-primary/10" />
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/30 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  );
}
