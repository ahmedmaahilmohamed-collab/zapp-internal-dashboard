import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Database, Download, Pencil, Plus, RefreshCcw, Search, Trash2, X } from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  CostPayload,
  CostRecord,
  CostTemplateRecord,
  CurrencyPayload,
  CurrencyRecord,
  DashboardOrder,
  DashboardRequest,
  ShippingRatePayload,
  ShippingRateRecord,
  createCost,
  createCurrency,
  createShippingRate,
  deleteCost,
  deleteCurrency,
  deleteShippingRate,
  fetchCosts,
  fetchCostTemplates,
  fetchCurrencies,
  fetchOrders,
  fetchRequests,
  fetchShippingRates,
  updateCost,
  updateCurrency,
  updateShippingRate,
} from "../lib/api";
import { useToast } from "../lib/toast-context";
import { cn, downloadCsv, formatCurrency, formatDate, safeDisplay } from "../lib/utils";

const inputClass =
  "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring";
const textareaClass =
  "min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-ring";

function ErrorBanner({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <Card className="border-orange-500/30 bg-orange-500/5">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 text-sm text-orange-700 dark:text-orange-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
        <Button variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

function InlineFormError({ error }: { error: string }) {
  if (!error) {
    return null;
  }

  return (
    <div className="rounded-md border border-orange-500/30 bg-orange-500/5 p-3 text-sm text-orange-700 dark:text-orange-300">
      {error}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Database className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-medium">No {label} found</p>
        <p className="mt-1 text-sm text-muted-foreground">Create a record or adjust the filters.</p>
      </div>
    </CardContent>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border bg-card shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b bg-card p-5">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button aria-label="Close" size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return <Badge variant={active ? "success" : "muted"}>{active ? "Active" : "Inactive"}</Badge>;
}

function PageHeader({
  title,
  subtitle,
  loading,
  onRefresh,
  onCreate,
  onExport,
}: {
  title: string;
  subtitle: string;
  loading: boolean;
  onRefresh: () => void;
  onCreate: () => void;
  onExport?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {onExport ? (
          <Button variant="outline" onClick={onExport}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        ) : null}
        <Button disabled={loading} variant="outline" onClick={onRefresh}>
          <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
        <Button onClick={onCreate}>
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>
    </div>
  );
}

function baseCurrencyCode(currencies: CurrencyRecord[]) {
  return (
    currencies.find((currency) => currency.is_base && currency.is_active)?.code ||
    currencies.find((currency) => currency.is_active)?.code ||
    "MVR"
  );
}

function currencyOptionLabel(currency: CurrencyRecord) {
  return `${currency.code}${currency.symbol ? ` (${currency.symbol})` : ""}`;
}

function CurrencySelect({
  currencies,
  value,
  onChange,
  includeAll = false,
}: {
  currencies: CurrencyRecord[];
  value: string;
  onChange: (value: string) => void;
  includeAll?: boolean;
}) {
  return (
    <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
      {includeAll ? <option value="">All currencies</option> : null}
      {!includeAll && currencies.length === 0 ? <option value={value || "MVR"}>{value || "MVR"}</option> : null}
      {currencies.map((currency) => (
        <option key={currency.id} value={currency.code}>
          {currencyOptionLabel(currency)}
          {currency.is_base ? " - base" : ""}
        </option>
      ))}
    </select>
  );
}

function exportRows(filename: string, rows: Record<string, unknown>[], notify: (message: string, tone?: "success" | "error" | "info") => void) {
  const exported = downloadCsv(filename, rows);
  notify(exported ? "CSV export downloaded." : "No records to export.", exported ? "success" : "info");
}

const blankCurrency = {
  code: "",
  name: "",
  symbol: "",
  exchange_rate_to_base: "1",
  is_base: false,
  is_active: true,
};

const commonCurrencies = [
  { code: "MVR", name: "Maldivian Rufiyaa", symbol: "ރ" },
  { code: "USD", name: "United States Dollar", symbol: "$" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "THB", name: "Thai Baht", symbol: "฿" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "LKR", name: "Sri Lankan Rupee", symbol: "Rs" },
];

export function CurrenciesPage() {
  const { notify } = useToast();
  const [records, setRecords] = useState<CurrencyRecord[]>([]);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<CurrencyRecord | null>(null);
  const [form, setForm] = useState(blankCurrency);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [currencyPickerSearch, setCurrencyPickerSearch] = useState("");
  const [customCurrencyOpen, setCustomCurrencyOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRecords(await fetchCurrencies({ search, includeInactive }));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to load currencies.";
      setError(message);
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  }, [includeInactive, notify, search]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ ...blankCurrency });
    setFormError("");
    setCurrencyPickerSearch("");
    setCustomCurrencyOpen(false);
    setFormOpen(true);
  }

  function openEdit(record: CurrencyRecord) {
    setEditing(record);
    setForm({
      code: record.code,
      name: record.name,
      symbol: record.symbol,
      exchange_rate_to_base: String(record.exchange_rate_to_base),
      is_base: record.is_base,
      is_active: record.is_active,
    });
    setFormError("");
    setCurrencyPickerSearch("");
    setCustomCurrencyOpen(!commonCurrencies.some((currency) => currency.code === record.code));
    setFormOpen(true);
  }

  function closeForm() {
    setEditing(null);
    setForm(blankCurrency);
    setFormError("");
    setCurrencyPickerSearch("");
    setCustomCurrencyOpen(false);
    setFormOpen(false);
  }

  const filteredCommonCurrencies = useMemo(() => {
    const query = currencyPickerSearch.trim().toLowerCase();
    if (!query) {
      return commonCurrencies;
    }
    return commonCurrencies.filter((currency) =>
      [currency.code, currency.name, currency.symbol].some((value) => value.toLowerCase().includes(query)),
    );
  }, [currencyPickerSearch]);

  function selectCommonCurrency(currency: (typeof commonCurrencies)[number]) {
    setForm((current) => ({
      ...current,
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
    }));
    setCustomCurrencyOpen(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    if (!form.code.trim() || !form.name.trim()) {
      setFormError("Choose a currency or use custom currency entry.");
      return;
    }
    setSaving(true);
    const payload: CurrencyPayload = {
      ...form,
      code: form.code.toUpperCase(),
      exchange_rate_to_base: Number(form.exchange_rate_to_base),
    };
    try {
      if (editing) {
        await updateCurrency(editing.id, payload);
      } else {
        await createCurrency(payload);
      }
      closeForm();
      await load();
      notify(editing ? "Currency updated." : "Currency created.", "success");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to save currency.";
      setFormError(message);
      setError(message);
      notify(message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(id: number) {
    if (!window.confirm("Deactivate this currency?")) {
      return;
    }
    try {
      await deleteCurrency(id);
      await load();
      notify("Currency deactivated.", "success");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to deactivate currency.";
      setError(message);
      notify(message, "error");
    }
  }

  async function setBaseCurrency(record: CurrencyRecord) {
    try {
      await updateCurrency(record.id, { is_base: true, is_active: true });
      await load();
      notify(`${record.code} set as base currency.`, "success");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to update base currency.";
      setError(message);
      notify(message, "error");
    }
  }

  function exportCurrencies() {
    exportRows(
      "currencies.csv",
      records.map((record) => ({
        code: record.code,
        name: record.name,
        symbol: record.symbol,
        exchange_rate_to_base: record.exchange_rate_to_base,
        is_base: record.is_base,
        is_active: record.is_active,
        updated_at: record.updated_at,
      })),
      notify,
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        loading={loading}
        subtitle="Manage exchange rates and base currency for dashboard calculations."
        title="Currencies"
        onCreate={openCreate}
        onExport={exportCurrencies}
        onRefresh={load}
      />

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={cn(inputClass, "pl-9")}
              placeholder="Search code or name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
            <input
              checked={includeInactive}
              type="checkbox"
              onChange={(event) => setIncludeInactive(event.target.checked)}
            />
            Include inactive
          </label>
        </CardContent>
      </Card>

      {error ? <ErrorBanner error={error} onRetry={load} /> : null}

      <Card className="overflow-hidden">
        <CardHeader className="border-b p-4">
          <CardTitle>Currencies</CardTitle>
        </CardHeader>
        {loading ? (
          <CardContent className="space-y-3 p-4">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-14 animate-pulse rounded-md bg-muted" />
            ))}
          </CardContent>
        ) : records.length === 0 ? (
          <EmptyState label="currencies" />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Rate to base</th>
                    <th className="px-4 py-3">State</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">
                        {record.symbol} {record.code}
                        {record.is_base ? <Badge className="ml-2" variant="default">Base</Badge> : null}
                      </td>
                      <td className="px-4 py-3">{record.name}</td>
                      <td className="px-4 py-3">{Number(record.exchange_rate_to_base).toFixed(4)}</td>
                      <td className="px-4 py-3"><ActiveBadge active={record.is_active} /></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {!record.is_base ? (
                            <Button size="sm" variant="outline" onClick={() => void setBaseCurrency(record)}>
                              Set base
                            </Button>
                          ) : null}
                          <Button size="icon" variant="ghost" onClick={() => openEdit(record)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deactivate(record.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 p-4 md:hidden">
              {records.map((record) => (
                <div key={record.id} className="rounded-md border p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{record.code}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{record.name}</p>
                    </div>
                    <ActiveBadge active={record.is_active} />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(record)}>Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => deactivate(record.id)}>Deactivate</Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {formOpen ? (
        <Modal title={editing ? "Edit Currency" : "New Currency"} onClose={closeForm}>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
            {formError ? <div className="sm:col-span-2"><InlineFormError error={formError} /></div> : null}
            <div className="space-y-3 sm:col-span-2">
              <Field label="Find currency">
                <input
                  className={inputClass}
                  placeholder="Search MVR, USD, Malaysia, Euro..."
                  value={currencyPickerSearch}
                  onChange={(event) => setCurrencyPickerSearch(event.target.value)}
                />
              </Field>
              <div className="grid max-h-56 gap-2 overflow-y-auto rounded-md border bg-muted/20 p-2 sm:grid-cols-2">
                {filteredCommonCurrencies.map((currency) => {
                  const selected = form.code.toUpperCase() === currency.code;
                  return (
                    <button
                      key={currency.code}
                      className={cn(
                        "rounded-md border bg-background p-3 text-left transition hover:bg-muted/60",
                        selected && "border-primary bg-primary/10",
                      )}
                      type="button"
                      onClick={() => selectCommonCurrency(currency)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">{currency.code}</span>
                        <span className="text-sm text-muted-foreground">{currency.symbol}</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{currency.name}</p>
                    </button>
                  );
                })}
                {filteredCommonCurrencies.length === 0 ? (
                  <div className="rounded-md border p-3 text-sm text-muted-foreground sm:col-span-2">
                    No common currency matches. Use custom entry below.
                  </div>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCustomCurrencyOpen((current) => !current)}
              >
                {customCurrencyOpen ? "Hide custom currency fields" : "Advanced: custom currency entry"}
              </Button>
            </div>
            {customCurrencyOpen ? (
              <>
                <Field label="Code"><input required className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
                <Field label="Name"><input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <Field label="Symbol"><input className={inputClass} value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} /></Field>
              </>
            ) : (
              <div className="rounded-md border bg-muted/20 p-3 sm:col-span-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Selected currency</p>
                <p className="mt-2 text-sm font-semibold">
                  {form.code ? `${form.code} - ${form.name || "Unnamed currency"} ${form.symbol ? `(${form.symbol})` : ""}` : "Choose a currency above"}
                </p>
              </div>
            )}
            <Field label="Rate to base"><input required min="0.000001" step="0.000001" type="number" className={inputClass} value={form.exchange_rate_to_base} onChange={(e) => setForm({ ...form, exchange_rate_to_base: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input checked={form.is_base} type="checkbox" onChange={(e) => setForm({ ...form, is_base: e.target.checked })} /> Base currency</label>
            <label className="flex items-center gap-2 text-sm"><input checked={form.is_active} type="checkbox" onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button disabled={saving} type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              <Button disabled={saving} type="submit">{saving ? "Saving..." : "Save"}</Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

const blankShipping = {
  name: "",
  origin_country: "Malaysia",
  destination_country: "Maldives",
  carrier: "",
  service_level: "",
  min_weight: "0",
  max_weight: "1",
  rate: "0",
  currency: "MVR",
  estimated_days_min: "",
  estimated_days_max: "",
  is_active: true,
  notes: "",
};

export function ShippingRatesPage() {
  const { notify } = useToast();
  const [records, setRecords] = useState<ShippingRateRecord[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyRecord[]>([]);
  const [filters, setFilters] = useState({ search: "", destinationCountry: "", carrier: "", currency: "", includeInactive: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<ShippingRateRecord | null>(null);
  const [form, setForm] = useState(blankShipping);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [rates, activeCurrencies] = await Promise.all([
        fetchShippingRates(filters),
        fetchCurrencies({ includeInactive: false }),
      ]);
      setRecords(rates);
      setCurrencies(activeCurrencies);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to load shipping rates.";
      setError(message);
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  }, [filters, notify]);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ ...blankShipping, currency: baseCurrencyCode(currencies) });
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(record: ShippingRateRecord) {
    setEditing(record);
    setForm({
      name: record.name,
      origin_country: record.origin_country,
      destination_country: record.destination_country,
      carrier: record.carrier,
      service_level: record.service_level,
      min_weight: String(record.min_weight),
      max_weight: String(record.max_weight),
      rate: String(record.rate),
      currency: record.currency,
      estimated_days_min: record.estimated_days_min === null ? "" : String(record.estimated_days_min),
      estimated_days_max: record.estimated_days_max === null ? "" : String(record.estimated_days_max),
      is_active: record.is_active,
      notes: record.notes || "",
    });
    setFormError("");
    setFormOpen(true);
  }

  function closeForm() {
    setEditing(null);
    setForm(blankShipping);
    setFormError("");
    setFormOpen(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setSaving(true);
    const payload: ShippingRatePayload = {
      ...form,
      currency: form.currency.toUpperCase(),
      min_weight: Number(form.min_weight),
      max_weight: Number(form.max_weight),
      rate: Number(form.rate),
      estimated_days_min: form.estimated_days_min ? Number(form.estimated_days_min) : null,
      estimated_days_max: form.estimated_days_max ? Number(form.estimated_days_max) : null,
      notes: form.notes || null,
    };
    try {
      if (editing) {
        await updateShippingRate(editing.id, payload);
      } else {
        await createShippingRate(payload);
      }
      closeForm();
      await load();
      notify(editing ? "Shipping rate updated." : "Shipping rate created.", "success");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to save shipping rate.";
      setFormError(message);
      setError(message);
      notify(message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function deactivateShippingRate(id: number) {
    if (!window.confirm("Deactivate this shipping rate card?")) {
      return;
    }
    try {
      await deleteShippingRate(id);
      await load();
      notify("Shipping rate deactivated.", "success");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to deactivate shipping rate.";
      setError(message);
      notify(message, "error");
    }
  }

  function exportShippingRates() {
    exportRows(
      "shipping-rates.csv",
      records.map((record) => ({
        name: record.name,
        origin_country: record.origin_country,
        destination_country: record.destination_country,
        carrier: record.carrier,
        service_level: record.service_level,
        min_weight: record.min_weight,
        max_weight: record.max_weight,
        rate: record.rate,
        currency: record.currency,
        estimated_days_min: record.estimated_days_min,
        estimated_days_max: record.estimated_days_max,
        is_active: record.is_active,
        updated_at: record.updated_at,
      })),
      notify,
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        loading={loading}
        subtitle="Manage carrier rates by country, service, weight band, and currency."
        title="Shipping Rates"
        onCreate={openCreate}
        onExport={exportShippingRates}
        onRefresh={load}
      />
      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-5">
          <input className={inputClass} placeholder="Search" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          <input className={inputClass} placeholder="Destination" value={filters.destinationCountry} onChange={(e) => setFilters({ ...filters, destinationCountry: e.target.value })} />
          <input className={inputClass} placeholder="Carrier" value={filters.carrier} onChange={(e) => setFilters({ ...filters, carrier: e.target.value })} />
          <CurrencySelect
            includeAll
            currencies={currencies}
            value={filters.currency}
            onChange={(value) => setFilters({ ...filters, currency: value })}
          />
          <label className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
            <input checked={filters.includeInactive} type="checkbox" onChange={(e) => setFilters({ ...filters, includeInactive: e.target.checked })} />
            Include inactive
          </label>
        </CardContent>
      </Card>
      {error ? <ErrorBanner error={error} onRetry={load} /> : null}
      <Card className="overflow-hidden">
        <CardHeader className="border-b p-4"><CardTitle>Rate Cards</CardTitle></CardHeader>
        {loading ? <CardContent className="space-y-3 p-4">{[0,1,2].map((i)=><div key={i} className="h-14 animate-pulse rounded-md bg-muted" />)}</CardContent> : records.length === 0 ? <EmptyState label="shipping rates" /> : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Route</th><th className="px-4 py-3">Weight</th><th className="px-4 py-3">Rate</th><th className="px-4 py-3">ETA</th><th className="px-4 py-3">State</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                <tbody className="divide-y">{records.map((record)=><tr key={record.id} className="hover:bg-muted/30"><td className="px-4 py-3 font-medium">{record.name}<p className="mt-1 text-muted-foreground">{record.carrier} · {record.service_level || "Standard"}</p></td><td className="px-4 py-3">{record.origin_country} to {record.destination_country}</td><td className="px-4 py-3">{record.min_weight}-{record.max_weight} kg</td><td className="px-4 py-3">{formatCurrency(Number(record.rate), record.currency)}/kg</td><td className="px-4 py-3">{safeDisplay(record.estimated_days_min)}-{safeDisplay(record.estimated_days_max)} days</td><td className="px-4 py-3"><ActiveBadge active={record.is_active} /></td><td className="px-4 py-3"><div className="flex justify-end gap-2"><Button size="icon" variant="ghost" onClick={() => openEdit(record)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => deactivateShippingRate(record.id)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}</tbody>
              </table>
            </div>
            <div className="grid gap-3 p-4 md:hidden">{records.map((record)=><div key={record.id} className="rounded-md border p-4"><div className="flex items-start justify-between"><div><p className="font-semibold">{record.name}</p><p className="mt-1 text-xs text-muted-foreground">{record.origin_country} to {record.destination_country}</p></div><ActiveBadge active={record.is_active} /></div><p className="mt-3 text-sm">{record.min_weight}-{record.max_weight} kg · {formatCurrency(Number(record.rate), record.currency)}/kg</p><div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={() => openEdit(record)}>Edit</Button><Button size="sm" variant="outline" onClick={() => deactivateShippingRate(record.id)}>Deactivate</Button></div></div>)}</div>
          </>
        )}
      </Card>
      {formOpen ? (
        <Modal title={editing ? "Edit Shipping Rate" : "New Shipping Rate"} onClose={closeForm}>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
            {formError ? <div className="sm:col-span-2"><InlineFormError error={formError} /></div> : null}
            <Field label="Name"><input required className={inputClass} value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} /></Field>
            <Field label="Carrier"><input required className={inputClass} value={form.carrier} onChange={(e)=>setForm({...form,carrier:e.target.value})} /></Field>
            <Field label="Origin country"><input required className={inputClass} value={form.origin_country} onChange={(e)=>setForm({...form,origin_country:e.target.value})} /></Field>
            <Field label="Destination country"><input required className={inputClass} value={form.destination_country} onChange={(e)=>setForm({...form,destination_country:e.target.value})} /></Field>
            <Field label="Service level"><input className={inputClass} value={form.service_level} onChange={(e)=>setForm({...form,service_level:e.target.value})} /></Field>
            <Field label="Currency">
              <CurrencySelect
                currencies={currencies}
                value={form.currency}
                onChange={(value) => setForm({ ...form, currency: value })}
              />
            </Field>
            <Field label="Min weight"><input required min="0" step="0.001" type="number" className={inputClass} value={form.min_weight} onChange={(e)=>setForm({...form,min_weight:e.target.value})} /></Field>
            <Field label="Max weight"><input required min="0" step="0.001" type="number" className={inputClass} value={form.max_weight} onChange={(e)=>setForm({...form,max_weight:e.target.value})} /></Field>
            <Field label="Rate"><input required min="0" step="0.01" type="number" className={inputClass} value={form.rate} onChange={(e)=>setForm({...form,rate:e.target.value})} /></Field>
            <Field label="ETA min"><input min="0" type="number" className={inputClass} value={form.estimated_days_min} onChange={(e)=>setForm({...form,estimated_days_min:e.target.value})} /></Field>
            <Field label="ETA max"><input min="0" type="number" className={inputClass} value={form.estimated_days_max} onChange={(e)=>setForm({...form,estimated_days_max:e.target.value})} /></Field>
            <label className="flex items-center gap-2 text-sm"><input checked={form.is_active} type="checkbox" onChange={(e)=>setForm({...form,is_active:e.target.checked})} /> Active</label>
            <Field label="Notes"><textarea className={textareaClass} value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} /></Field>
            <div className="flex justify-end gap-2 sm:col-span-2"><Button disabled={saving} type="button" variant="outline" onClick={closeForm}>Cancel</Button><Button disabled={saving} type="submit">{saving ? "Saving..." : "Save"}</Button></div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

const costComponentFields = [
  { key: "product_purchase_cost", label: "Product Purchase Cost" },
  { key: "bml_tax", label: "BML / Payment Tax" },
  { key: "import_tax", label: "Import Tax" },
  { key: "shipping_cost", label: "Shipping Cost" },
  { key: "additional_cost", label: "Additional Cost" },
] as const;

type CostComponentKey = (typeof costComponentFields)[number]["key"];
type CostForm = Record<CostComponentKey | "sale_total" | "target_margin_percent", string> & {
  template_id: string;
  source_type: "order" | "request" | "manual";
  source_id: string;
  linked_order_id: string;
  linked_request_id: string;
  reference_label: string;
  customer_name: string;
  title: string;
  supplier_name: string;
  currency: string;
  notes: string;
};

const blankCost: CostForm = {
  template_id: "",
  source_type: "manual",
  source_id: "",
  linked_order_id: "",
  linked_request_id: "",
  reference_label: "",
  customer_name: "",
  title: "",
  supplier_name: "",
  product_purchase_cost: "0",
  bml_tax: "0",
  import_tax: "0",
  shipping_cost: "0",
  additional_cost: "0",
  sale_total: "0",
  target_margin_percent: "",
  currency: "MVR",
  notes: "",
};

function recordType(record: CostRecord) {
  if (record.source_type === "order" || record.linked_order_id) return "ORDER";
  if (record.source_type === "request" || record.linked_request_id) return "REQUEST";
  return "MANUAL";
}

function recordSourceId(record: CostRecord) {
  return record.source_id || record.linked_order_id || record.linked_request_id || "";
}

function totalCostFromRecord(record: CostRecord) {
  return Number(
    record.total_cost ??
      costComponentFields.reduce((sum, field) => sum + Number(record[field.key] || 0), 0),
  );
}

function marginTone(record: CostRecord) {
  const margin = record.margin_percent === null ? null : Number(record.margin_percent);
  if (margin !== null && margin < 10) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

function costNumber(value: string) {
  return Number(value || 0);
}

export function CostsPage() {
  const { notify } = useToast();
  const [records, setRecords] = useState<CostRecord[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyRecord[]>([]);
  const [templates, setTemplates] = useState<CostTemplateRecord[]>([]);
  const [filters, setFilters] = useState({ search: "", currency: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<CostRecord | null>(null);
  const [form, setForm] = useState<CostForm>({ ...blankCost });
  const [formOpen, setFormOpen] = useState(false);
  const [formStep, setFormStep] = useState<"link" | "details">("link");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [linkOrders, setLinkOrders] = useState<DashboardOrder[]>([]);
  const [linkRequests, setLinkRequests] = useState<DashboardRequest[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [costRecords, activeCurrencies, activeTemplates] = await Promise.all([
        fetchCosts(filters),
        fetchCurrencies({ includeInactive: false }),
        fetchCostTemplates({ includeInactive: false }),
      ]);
      setRecords(costRecords);
      setCurrencies(activeCurrencies);
      setTemplates(activeTemplates);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to load cost records.";
      setError(message);
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  }, [filters, notify]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => {
    const profit = records.reduce((sum, record) => sum + Number(record.profit || 0), 0);
    const revenue = records.reduce((sum, record) => sum + Number(record.sale_total || 0), 0);
    const totalCost = records.reduce((sum, record) => sum + totalCostFromRecord(record), 0);
    return { profit, revenue, totalCost };
  }, [records]);

  function activeCurrencyOrBase(code: string | null | undefined) {
    return currencies.some((currency) => currency.code === code && currency.is_active)
      ? String(code)
      : baseCurrencyCode(currencies);
  }

  function applyCostTemplate(templateId: string) {
    const template = templates.find((item) => String(item.id) === templateId);
    setForm((current) => {
      if (!template) {
        return { ...current, template_id: templateId };
      }
      return {
        ...current,
        template_id: templateId,
        bml_tax: String(template.default_bml_tax),
        import_tax: String(template.default_import_tax),
        shipping_cost: String(template.default_shipping_cost),
        additional_cost: String(template.default_additional_cost),
        target_margin_percent: String(template.default_margin_percent),
        currency: activeCurrencyOrBase(template.currency),
      };
    });
  }

  async function loadLinkOptions() {
    setLinkLoading(true);
    setLinkError("");
    try {
      const [orders, requests] = await Promise.all([
        fetchOrders({ page: 1, pageSize: 50 }),
        fetchRequests({ page: 1, pageSize: 50 }),
      ]);
      setLinkOrders(orders.items);
      setLinkRequests(requests.items);
    } catch (caught) {
      setLinkError(caught instanceof Error ? caught.message : "Unable to load live ZAPP records.");
    } finally {
      setLinkLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...blankCost, currency: baseCurrencyCode(currencies) });
    setFormError("");
    setFormStep("link");
    setFormOpen(true);
    void loadLinkOptions();
  }

  function openEdit(record: CostRecord) {
    const sourceType = record.source_type || (record.linked_order_id ? "order" : record.linked_request_id ? "request" : "manual");
    setEditing(record);
    setForm({
      template_id: "",
      source_type: sourceType,
      source_id: recordSourceId(record),
      linked_order_id: record.linked_order_id || "",
      linked_request_id: record.linked_request_id || "",
      reference_label: record.reference_label || "",
      customer_name: record.customer_name || "",
      title: record.title || "",
      supplier_name: record.supplier_name || "",
      product_purchase_cost: String(record.product_purchase_cost ?? record.item_cost ?? 0),
      bml_tax: String(record.bml_tax ?? record.payment_fee ?? 0),
      import_tax: String(record.import_tax ?? record.customs_cost ?? 0),
      shipping_cost: String(
        record.shipping_cost ??
          Number(record.international_shipping_cost || 0) + Number(record.local_delivery_cost || 0),
      ),
      additional_cost: String(
        record.additional_cost ??
          Number(record.packaging_cost || 0) + Number(record.other_cost || 0),
      ),
      sale_total: String(record.sale_total || 0),
      target_margin_percent: record.margin_percent === null ? "" : String(record.margin_percent),
      currency: activeCurrencyOrBase(record.currency),
      notes: record.notes || "",
    });
    setFormError("");
    setFormStep("details");
    setFormOpen(true);
  }

  function closeForm() {
    setEditing(null);
    setForm({ ...blankCost });
    setFormError("");
    setFormOpen(false);
  }

  function selectOrder(order: DashboardOrder) {
    setForm({
      ...blankCost,
      source_type: "order",
      source_id: order.id,
      linked_order_id: order.id,
      reference_label: order.orderName || order.orderNumber || order.id,
      customer_name: order.customerName,
      title: order.orderName || order.orderNumber || "Shopify order",
      sale_total: String(order.total || 0),
      currency: activeCurrencyOrBase(order.currency),
    });
    setFormStep("details");
  }

  function selectRequest(request: DashboardRequest) {
    setForm({
      ...blankCost,
      source_type: "request",
      source_id: request.id,
      linked_request_id: request.id,
      reference_label: request.requestNumber || request.reference || request.id,
      customer_name: request.customerName,
      title: request.productTitle || request.reference || "Purchase request",
      sale_total: String(request.quotedTotal || 0),
      currency: activeCurrencyOrBase(request.currency),
    });
    setFormStep("details");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError("");

    if (!form.source_id.trim()) {
      setFormError("Source ID is required.");
      return;
    }

    setSaving(true);
    const payload: CostPayload = {
      source_type: form.source_type,
      source_id: form.source_id || null,
      linked_order_id: form.source_type === "order" ? form.source_id : null,
      linked_request_id: form.source_type === "request" ? form.source_id : null,
      reference_label: form.reference_label || null,
      customer_name: form.customer_name || null,
      title: form.title || null,
      supplier_name: form.supplier_name || null,
      product_purchase_cost: costNumber(form.product_purchase_cost),
      bml_tax: costNumber(form.bml_tax),
      import_tax: costNumber(form.import_tax),
      shipping_cost: costNumber(form.shipping_cost),
      additional_cost: costNumber(form.additional_cost),
      sale_total: costNumber(form.sale_total),
      currency: form.currency.toUpperCase(),
      notes: form.notes || null,
    };

    try {
      if (editing) {
        await updateCost(editing.id, payload);
      } else {
        await createCost(payload);
      }
      closeForm();
      await load();
      notify(editing ? "Cost record updated." : "Cost record created.", "success");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to save cost record.";
      setFormError(message);
      setError(message);
      notify(message, "error");
    } finally {
      setSaving(false);
    }
  }

  function profitTone(record: CostRecord) {
    const profit = Number(record.profit);
    if (profit < 0) return "text-red-600 dark:text-red-400";
    if (profit > 0) return "text-emerald-600 dark:text-emerald-400";
    return "text-muted-foreground";
  }

  async function removeCost(id: number) {
    if (!window.confirm("Delete this cost record?")) {
      return;
    }
    try {
      await deleteCost(id);
      await load();
      notify("Cost record deleted.", "success");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to delete cost record.";
      setError(message);
      notify(message, "error");
    }
  }

  function exportCosts() {
    exportRows(
      "internal-cost-records.csv",
      records.map((record) => ({
        source_type: recordType(record),
        source_id: recordSourceId(record),
        reference: record.reference_label,
        customer: record.customer_name,
        title: record.title,
        supplier: record.supplier_name,
        product_purchase_cost: record.product_purchase_cost,
        bml_tax: record.bml_tax,
        import_tax: record.import_tax,
        shipping_cost: record.shipping_cost,
        additional_cost: record.additional_cost,
        sale_total: record.sale_total,
        total_cost: totalCostFromRecord(record),
        profit: record.profit,
        margin_percent: record.margin_percent,
        currency: record.currency,
        updated_at: record.updated_at,
      })),
      notify,
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        loading={loading}
        subtitle="Track true profitability for ZAPP orders and purchase requests."
        title="Internal Cost Records"
        onCreate={openCreate}
        onExport={exportCosts}
        onRefresh={load}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Records</p><p className="mt-2 text-2xl font-bold">{records.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Revenue</p><p className="mt-2 text-2xl font-bold">{formatCurrency(totals.revenue, records[0]?.currency || "MVR")}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Cost</p><p className="mt-2 text-2xl font-bold">{formatCurrency(totals.totalCost, records[0]?.currency || "MVR")}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Profit</p><p className={cn("mt-2 text-2xl font-bold", totals.profit < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>{formatCurrency(totals.profit, records[0]?.currency || "MVR")}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_200px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={cn(inputClass, "pl-9")}
              placeholder="Search source ID, reference, customer, title, supplier"
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
            />
          </label>
          <CurrencySelect
            includeAll
            currencies={currencies}
            value={filters.currency}
            onChange={(value) => setFilters({ ...filters, currency: value })}
          />
        </CardContent>
      </Card>

      {error ? <ErrorBanner error={error} onRetry={load} /> : null}

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b p-4">
          <CardTitle>Internal Cost Records</CardTitle>
          <Badge variant="muted">{records.length} records</Badge>
        </CardHeader>
        {loading ? (
          <CardContent className="space-y-3 p-4">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />)}</CardContent>
        ) : records.length === 0 ? (
          <EmptyState label="cost records" />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Revenue</th>
                    <th className="px-4 py-3">Total Cost</th>
                    <th className="px-4 py-3">Profit</th>
                    <th className="px-4 py-3">Margin</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3"><Badge variant={recordType(record) === "ORDER" ? "default" : recordType(record) === "REQUEST" ? "success" : "muted"}>{recordType(record)}</Badge></td>
                      <td className="px-4 py-3 font-medium">
                        {safeDisplay(record.reference_label || recordSourceId(record), `Cost #${record.id}`)}
                        <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{safeDisplay(recordSourceId(record))}</p>
                        {record.title ? <p className="mt-1 truncate text-muted-foreground">{record.title}</p> : null}
                      </td>
                      <td className="px-4 py-3">{safeDisplay(record.customer_name || record.supplier_name)}</td>
                      <td className="px-4 py-3">{formatCurrency(Number(record.sale_total), record.currency)}</td>
                      <td className="px-4 py-3">{formatCurrency(totalCostFromRecord(record), record.currency)}</td>
                      <td className={cn("px-4 py-3 font-semibold", profitTone(record))}>
                        <span className="inline-flex items-center gap-1">
                          {Number(record.profit) < 0 ? <AlertCircle className="h-3.5 w-3.5" /> : null}
                          {formatCurrency(Number(record.profit), record.currency)}
                        </span>
                      </td>
                      <td className={cn("px-4 py-3 font-medium", marginTone(record))}>
                        {record.margin_percent === null ? "--" : `${Number(record.margin_percent).toFixed(2)}%`}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(record)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => removeCost(record.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 p-4 lg:hidden">
              {records.map((record) => (
                <div key={record.id} className="rounded-md border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Badge variant={recordType(record) === "ORDER" ? "default" : recordType(record) === "REQUEST" ? "success" : "muted"}>{recordType(record)}</Badge>
                      <p className="mt-2 font-semibold">{safeDisplay(record.reference_label || recordSourceId(record), `Cost #${record.id}`)}</p>
                      <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{safeDisplay(recordSourceId(record))}</p>
                    </div>
                    <p className={cn("shrink-0 font-semibold", profitTone(record))}>{formatCurrency(Number(record.profit), record.currency)}</p>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Revenue {formatCurrency(Number(record.sale_total), record.currency)} · Cost {formatCurrency(totalCostFromRecord(record), record.currency)} · Margin {record.margin_percent === null ? "--" : `${Number(record.margin_percent).toFixed(2)}%`}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(record)}>Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => removeCost(record.id)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {formOpen ? (
        <Modal title={editing ? "Edit Cost Record" : "New Cost Record"} onClose={closeForm}>
          {formStep === "link" ? (
            <div className="space-y-4">
              {linkError ? <InlineFormError error={linkError} /> : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Link to ZAPP order/request</p>
                  <p className="mt-1 text-sm text-muted-foreground">Choose a live record to prefill details, or enter manually.</p>
                </div>
                <Button variant="outline" onClick={() => setFormStep("details")}>Skip - enter manually</Button>
              </div>
              {linkLoading ? (
                <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />)}</div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  <LinkPicker title="Orders" empty="No live orders loaded">
                    {linkOrders.map((order) => (
                      <button key={order.id} className="w-full rounded-md border p-3 text-left transition hover:bg-muted/40" type="button" onClick={() => selectOrder(order)}>
                        <p className="text-sm font-medium">{safeDisplay(order.orderName || order.orderNumber || order.id)}</p>
                        <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{safeDisplay(order.id)}</p>
                        <p className="mt-2 text-xs text-muted-foreground">{safeDisplay(order.customerName)} · {formatCurrency(order.total, order.currency)}</p>
                      </button>
                    ))}
                  </LinkPicker>
                  <LinkPicker title="Requests" empty="No live requests loaded">
                    {linkRequests.map((request) => (
                      <button key={request.id} className="w-full rounded-md border p-3 text-left transition hover:bg-muted/40" type="button" onClick={() => selectRequest(request)}>
                        <p className="text-sm font-medium">{safeDisplay(request.requestNumber || request.reference || request.id)}</p>
                        <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{safeDisplay(request.id)}</p>
                        <p className="mt-2 text-xs text-muted-foreground">{safeDisplay(request.customerName)} · {formatCurrency(request.quotedTotal, request.currency)}</p>
                      </button>
                    ))}
                  </LinkPicker>
                </div>
              )}
            </div>
          ) : (
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
              {formError ? <div className="sm:col-span-2"><InlineFormError error={formError} /></div> : null}
              {!editing ? (
                <div className="sm:col-span-2">
                  <Button type="button" variant="outline" onClick={() => setFormStep("link")}>Back to ZAPP link</Button>
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <Field label="Cost Template">
                  <select className={inputClass} value={form.template_id} onChange={(event) => applyCostTemplate(event.target.value)}>
                    <option value="">No template</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} ({template.currency})
                      </option>
                    ))}
                  </select>
                </Field>
                <p className="mt-1 text-xs text-muted-foreground">
                  Selecting a template fills BML/payment tax, import tax, shipping, additional cost, and currency. You can still override every field.
                </p>
              </div>
              <Field label="Source Type">
                <select className={inputClass} value={form.source_type} onChange={(event) => setForm({ ...form, source_type: event.target.value as CostForm["source_type"] })}>
                  <option value="order">Shopify Order</option>
                  <option value="request">Purchase Request</option>
                  <option value="manual">Manual</option>
                </select>
              </Field>
              <Field label="Source ID"><input required className={inputClass} value={form.source_id} onChange={(event) => setForm({ ...form, source_id: event.target.value })} /></Field>
              <Field label="Reference"><input className={inputClass} value={form.reference_label} onChange={(event) => setForm({ ...form, reference_label: event.target.value })} /></Field>
              <Field label="Customer"><input className={inputClass} value={form.customer_name} onChange={(event) => setForm({ ...form, customer_name: event.target.value })} /></Field>
              <Field label="Title"><input className={inputClass} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
              <Field label="Supplier"><input className={inputClass} value={form.supplier_name} onChange={(event) => setForm({ ...form, supplier_name: event.target.value })} /></Field>
              <Field label="Revenue"><input required min="0" step="0.01" type="number" className={inputClass} value={form.sale_total} onChange={(event) => setForm({ ...form, sale_total: event.target.value })} /></Field>
              <Field label="Target Margin %">
                <input min="0" max="99" step="0.01" type="number" className={inputClass} value={form.target_margin_percent} onChange={(event) => setForm({ ...form, target_margin_percent: event.target.value })} />
              </Field>
              <Field label="Currency">
                <CurrencySelect
                  currencies={currencies}
                  value={form.currency}
                  onChange={(value) => setForm({ ...form, currency: value })}
                />
              </Field>
              <div className="space-y-3 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cost Breakdown</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {costComponentFields.map((field) => (
                    <Field key={field.key} label={field.label}>
                      <input required min="0" step="0.01" type="number" className={inputClass} value={form[field.key]} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} />
                    </Field>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2">
                <Field label="Notes"><textarea className={textareaClass} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
              </div>
              <div className="flex justify-end gap-2 sm:col-span-2"><Button disabled={saving} type="button" variant="outline" onClick={closeForm}>Cancel</Button><Button disabled={saving} type="submit">{saving ? "Saving..." : "Save"}</Button></div>
            </form>
          )}
        </Modal>
      ) : null}
    </div>
  );
}

function LinkPicker({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {hasChildren ? children : <div className="rounded-md border p-4 text-sm text-muted-foreground">{empty}</div>}
      </div>
    </div>
  );
}
