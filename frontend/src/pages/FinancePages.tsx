import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Database, Pencil, Plus, RefreshCcw, Search, Trash2, X } from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  CostPayload,
  CostRecord,
  CurrencyPayload,
  CurrencyRecord,
  ShippingRatePayload,
  ShippingRateRecord,
  createCost,
  createCurrency,
  createShippingRate,
  deleteCost,
  deleteCurrency,
  deleteShippingRate,
  fetchCosts,
  fetchCurrencies,
  fetchShippingRates,
  updateCost,
  updateCurrency,
  updateShippingRate,
} from "../lib/api";
import { cn, formatCurrency, formatDate, safeDisplay } from "../lib/utils";

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
}: {
  title: string;
  subtitle: string;
  loading: boolean;
  onRefresh: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex gap-2">
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

const blankCurrency = {
  code: "",
  name: "",
  symbol: "",
  exchange_rate_to_base: "1",
  is_base: false,
  is_active: true,
};

export function CurrenciesPage() {
  const [records, setRecords] = useState<CurrencyRecord[]>([]);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<CurrencyRecord | null>(null);
  const [form, setForm] = useState(blankCurrency);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRecords(await fetchCurrencies({ search, includeInactive }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load currencies.");
    } finally {
      setLoading(false);
    }
  }, [includeInactive, search]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(blankCurrency);
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
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
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
      setEditing(null);
      setForm(blankCurrency);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save currency.");
    }
  }

  async function deactivate(id: number) {
    if (!window.confirm("Deactivate this currency?")) {
      return;
    }
    await deleteCurrency(id);
    await load();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        loading={loading}
        subtitle="Manage exchange rates and base currency for dashboard calculations."
        title="Currencies"
        onCreate={openCreate}
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
                            <Button size="sm" variant="outline" onClick={() => updateCurrency(record.id, { is_base: true, is_active: true }).then(load)}>
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

      {(editing || form !== blankCurrency) ? (
        <Modal title={editing ? "Edit Currency" : "New Currency"} onClose={() => { setEditing(null); setForm(blankCurrency); }}>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
            <Field label="Code"><input required className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
            <Field label="Name"><input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Symbol"><input className={inputClass} value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} /></Field>
            <Field label="Rate to base"><input required min="0.000001" step="0.000001" type="number" className={inputClass} value={form.exchange_rate_to_base} onChange={(e) => setForm({ ...form, exchange_rate_to_base: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input checked={form.is_base} type="checkbox" onChange={(e) => setForm({ ...form, is_base: e.target.checked })} /> Base currency</label>
            <label className="flex items-center gap-2 text-sm"><input checked={form.is_active} type="checkbox" onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => { setEditing(null); setForm(blankCurrency); }}>Cancel</Button>
              <Button type="submit">Save</Button>
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
  const [records, setRecords] = useState<ShippingRateRecord[]>([]);
  const [filters, setFilters] = useState({ search: "", destinationCountry: "", carrier: "", currency: "", includeInactive: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<ShippingRateRecord | null>(null);
  const [form, setForm] = useState(blankShipping);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRecords(await fetchShippingRates(filters));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load shipping rates.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(blankShipping);
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
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
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
      setEditing(null);
      setForm(blankShipping);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save shipping rate.");
    }
  }

  async function deactivateShippingRate(id: number) {
    if (!window.confirm("Deactivate this shipping rate card?")) {
      return;
    }
    await deleteShippingRate(id);
    await load();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        loading={loading}
        subtitle="Manage carrier rates by country, service, weight band, and currency."
        title="Shipping Rates"
        onCreate={openCreate}
        onRefresh={load}
      />
      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-5">
          <input className={inputClass} placeholder="Search" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          <input className={inputClass} placeholder="Destination" value={filters.destinationCountry} onChange={(e) => setFilters({ ...filters, destinationCountry: e.target.value })} />
          <input className={inputClass} placeholder="Carrier" value={filters.carrier} onChange={(e) => setFilters({ ...filters, carrier: e.target.value })} />
          <input className={inputClass} placeholder="Currency" value={filters.currency} onChange={(e) => setFilters({ ...filters, currency: e.target.value })} />
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
      {(editing || form !== blankShipping) ? (
        <Modal title={editing ? "Edit Shipping Rate" : "New Shipping Rate"} onClose={() => { setEditing(null); setForm(blankShipping); }}>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
            <Field label="Name"><input required className={inputClass} value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} /></Field>
            <Field label="Carrier"><input required className={inputClass} value={form.carrier} onChange={(e)=>setForm({...form,carrier:e.target.value})} /></Field>
            <Field label="Origin country"><input required className={inputClass} value={form.origin_country} onChange={(e)=>setForm({...form,origin_country:e.target.value})} /></Field>
            <Field label="Destination country"><input required className={inputClass} value={form.destination_country} onChange={(e)=>setForm({...form,destination_country:e.target.value})} /></Field>
            <Field label="Service level"><input className={inputClass} value={form.service_level} onChange={(e)=>setForm({...form,service_level:e.target.value})} /></Field>
            <Field label="Currency"><input required className={inputClass} value={form.currency} onChange={(e)=>setForm({...form,currency:e.target.value})} /></Field>
            <Field label="Min weight"><input required min="0" step="0.001" type="number" className={inputClass} value={form.min_weight} onChange={(e)=>setForm({...form,min_weight:e.target.value})} /></Field>
            <Field label="Max weight"><input required min="0" step="0.001" type="number" className={inputClass} value={form.max_weight} onChange={(e)=>setForm({...form,max_weight:e.target.value})} /></Field>
            <Field label="Rate"><input required min="0" step="0.01" type="number" className={inputClass} value={form.rate} onChange={(e)=>setForm({...form,rate:e.target.value})} /></Field>
            <Field label="ETA min"><input min="0" type="number" className={inputClass} value={form.estimated_days_min} onChange={(e)=>setForm({...form,estimated_days_min:e.target.value})} /></Field>
            <Field label="ETA max"><input min="0" type="number" className={inputClass} value={form.estimated_days_max} onChange={(e)=>setForm({...form,estimated_days_max:e.target.value})} /></Field>
            <label className="flex items-center gap-2 text-sm"><input checked={form.is_active} type="checkbox" onChange={(e)=>setForm({...form,is_active:e.target.checked})} /> Active</label>
            <Field label="Notes"><textarea className={textareaClass} value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} /></Field>
            <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => { setEditing(null); setForm(blankShipping); }}>Cancel</Button><Button type="submit">Save</Button></div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

const costFields = [
  "item_cost",
  "international_shipping_cost",
  "local_delivery_cost",
  "customs_cost",
  "payment_fee",
  "packaging_cost",
  "other_cost",
  "sale_total",
] as const;

const blankCost = {
  linked_order_id: "",
  linked_request_id: "",
  reference_label: "",
  item_cost: "0",
  international_shipping_cost: "0",
  local_delivery_cost: "0",
  customs_cost: "0",
  payment_fee: "0",
  packaging_cost: "0",
  other_cost: "0",
  sale_total: "0",
  currency: "MVR",
  notes: "",
};

export function CostsPage() {
  const [records, setRecords] = useState<CostRecord[]>([]);
  const [filters, setFilters] = useState({ search: "", currency: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<CostRecord | null>(null);
  const [form, setForm] = useState(blankCost);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRecords(await fetchCosts(filters));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load cost records.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => {
    const profit = records.reduce((sum, record) => sum + Number(record.profit || 0), 0);
    const revenue = records.reduce((sum, record) => sum + Number(record.sale_total || 0), 0);
    return { profit, revenue };
  }, [records]);

  function openCreate() {
    setEditing(null);
    setForm(blankCost);
  }

  function openEdit(record: CostRecord) {
    setEditing(record);
    setForm({
      linked_order_id: record.linked_order_id || "",
      linked_request_id: record.linked_request_id || "",
      reference_label: record.reference_label || "",
      item_cost: String(record.item_cost),
      international_shipping_cost: String(record.international_shipping_cost),
      local_delivery_cost: String(record.local_delivery_cost),
      customs_cost: String(record.customs_cost),
      payment_fee: String(record.payment_fee),
      packaging_cost: String(record.packaging_cost),
      other_cost: String(record.other_cost),
      sale_total: String(record.sale_total),
      currency: record.currency,
      notes: record.notes || "",
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload: CostPayload = {
      linked_order_id: form.linked_order_id || null,
      linked_request_id: form.linked_request_id || null,
      reference_label: form.reference_label || null,
      item_cost: Number(form.item_cost),
      international_shipping_cost: Number(form.international_shipping_cost),
      local_delivery_cost: Number(form.local_delivery_cost),
      customs_cost: Number(form.customs_cost),
      payment_fee: Number(form.payment_fee),
      packaging_cost: Number(form.packaging_cost),
      other_cost: Number(form.other_cost),
      sale_total: Number(form.sale_total),
      currency: form.currency.toUpperCase(),
      notes: form.notes || null,
    };
    try {
      if (editing) {
        await updateCost(editing.id, payload);
      } else {
        await createCost(payload);
      }
      setEditing(null);
      setForm(blankCost);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save cost record.");
    }
  }

  function profitTone(record: CostRecord) {
    const profit = Number(record.profit);
    if (profit > 0) return "text-emerald-600 dark:text-emerald-400";
    if (profit < 0) return "text-red-600 dark:text-red-400";
    return "text-muted-foreground";
  }

  async function removeCost(id: number) {
    if (!window.confirm("Delete this cost record?")) {
      return;
    }
    await deleteCost(id);
    await load();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader loading={loading} subtitle="Track internal costs and profit per order or request." title="Costs" onCreate={openCreate} onRefresh={load} />
      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Records</p><p className="mt-2 text-2xl font-bold">{records.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sale total</p><p className="mt-2 text-2xl font-bold">{formatCurrency(totals.revenue, records[0]?.currency || "MVR")}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Profit</p><p className={cn("mt-2 text-2xl font-bold", totals.profit > 0 ? "text-emerald-600 dark:text-emerald-400" : totals.profit < 0 ? "text-red-600 dark:text-red-400" : "")}>{formatCurrency(totals.profit, records[0]?.currency || "MVR")}</p></CardContent></Card>
      </div>
      <Card><CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_160px]"><input className={inputClass} placeholder="Search reference, order, request, notes" value={filters.search} onChange={(e)=>setFilters({...filters,search:e.target.value})} /><input className={inputClass} placeholder="Currency" value={filters.currency} onChange={(e)=>setFilters({...filters,currency:e.target.value})} /></CardContent></Card>
      {error ? <ErrorBanner error={error} onRetry={load} /> : null}
      <Card className="overflow-hidden">
        <CardHeader className="border-b p-4"><CardTitle>Cost Records</CardTitle></CardHeader>
        {loading ? <CardContent className="space-y-3 p-4">{[0,1,2].map((i)=><div key={i} className="h-14 animate-pulse rounded-md bg-muted" />)}</CardContent> : records.length === 0 ? <EmptyState label="cost records" /> : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-xs"><thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Sale</th><th className="px-4 py-3">Profit</th><th className="px-4 py-3">Margin</th><th className="px-4 py-3">Updated</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y">{records.map((record)=><tr key={record.id} className="hover:bg-muted/30"><td className="px-4 py-3 font-medium">{safeDisplay(record.reference_label || record.linked_order_id || record.linked_request_id, `Cost #${record.id}`)}<p className="mt-1 text-muted-foreground">{safeDisplay(record.linked_order_id || record.linked_request_id)}</p></td><td className="px-4 py-3">{formatCurrency(Number(record.sale_total), record.currency)}</td><td className={cn("px-4 py-3 font-semibold", profitTone(record))}>{formatCurrency(Number(record.profit), record.currency)}</td><td className="px-4 py-3">{record.margin_percent === null ? "--" : `${Number(record.margin_percent).toFixed(2)}%`}</td><td className="px-4 py-3">{formatDate(record.updated_at)}</td><td className="px-4 py-3"><div className="flex justify-end gap-2"><Button size="icon" variant="ghost" onClick={()=>openEdit(record)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={()=>removeCost(record.id)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}</tbody></table>
            </div>
            <div className="grid gap-3 p-4 md:hidden">{records.map((record)=><div key={record.id} className="rounded-md border p-4"><div className="flex items-start justify-between"><div><p className="font-semibold">{safeDisplay(record.reference_label, `Cost #${record.id}`)}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(record.updated_at)}</p></div><p className={cn("font-semibold", profitTone(record))}>{formatCurrency(Number(record.profit), record.currency)}</p></div><p className="mt-3 text-sm">Sale {formatCurrency(Number(record.sale_total), record.currency)} · Margin {record.margin_percent === null ? "--" : `${Number(record.margin_percent).toFixed(2)}%`}</p><div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={()=>openEdit(record)}>Edit</Button><Button size="sm" variant="outline" onClick={()=>removeCost(record.id)}>Delete</Button></div></div>)}</div>
          </>
        )}
      </Card>
      {(editing || form !== blankCost) ? (
        <Modal title={editing ? "Edit Cost Record" : "New Cost Record"} onClose={() => { setEditing(null); setForm(blankCost); }}>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
            <Field label="Reference label"><input className={inputClass} value={form.reference_label} onChange={(e)=>setForm({...form,reference_label:e.target.value})} /></Field>
            <Field label="Currency"><input required className={inputClass} value={form.currency} onChange={(e)=>setForm({...form,currency:e.target.value})} /></Field>
            <Field label="Linked live order ID"><input className={inputClass} value={form.linked_order_id} onChange={(e)=>setForm({...form,linked_order_id:e.target.value})} /></Field>
            <Field label="Linked live request ID"><input className={inputClass} value={form.linked_request_id} onChange={(e)=>setForm({...form,linked_request_id:e.target.value})} /></Field>
            {costFields.map((field) => <Field key={field} label={field.replace(/_/g, " ")}><input required min="0" step="0.01" type="number" className={inputClass} value={form[field]} onChange={(e)=>setForm({...form,[field]:e.target.value})} /></Field>)}
            <Field label="Notes"><textarea className={textareaClass} value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} /></Field>
            <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => { setEditing(null); setForm(blankCost); }}>Cancel</Button><Button type="submit">Save</Button></div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
