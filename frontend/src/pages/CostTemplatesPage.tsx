import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Database, Pencil, Plus, RefreshCcw, Search, Trash2, X } from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  CostTemplatePayload,
  CostTemplateRecord,
  CurrencyRecord,
  createCostTemplate,
  deleteCostTemplate,
  fetchCostTemplates,
  fetchCurrencies,
  updateCostTemplate,
} from "../lib/api";
import { useToast } from "../lib/toast-context";
import { cn, formatCurrency, formatDate } from "../lib/utils";

const inputClass =
  "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring";
const textareaClass =
  "min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-ring";

const blankTemplate = {
  name: "",
  description: "",
  default_bml_tax: "0",
  default_import_tax: "0",
  default_shipping_cost: "0",
  default_additional_cost: "0",
  default_margin_percent: "25",
  currency: "MVR",
  is_active: true,
};

function numberFrom(value: string) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function baseCurrencyCode(currencies: CurrencyRecord[]) {
  return (
    currencies.find((currency) => currency.is_base && currency.is_active)?.code ||
    currencies.find((currency) => currency.is_active)?.code ||
    "MVR"
  );
}

export function CostTemplatesPage() {
  const { notify } = useToast();
  const [records, setRecords] = useState<CostTemplateRecord[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyRecord[]>([]);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<CostTemplateRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(blankTemplate);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [templates, activeCurrencies] = await Promise.all([
        fetchCostTemplates({ search, includeInactive }),
        fetchCurrencies({ includeInactive: false }),
      ]);
      setRecords(templates);
      setCurrencies(activeCurrencies);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to load cost templates.";
      setError(message);
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  }, [includeInactive, notify, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCurrencyCodes = useMemo(() => {
    const codes = currencies.filter((currency) => currency.is_active).map((currency) => currency.code);
    return codes.length ? codes : [form.currency || "MVR"];
  }, [currencies, form.currency]);

  function openCreate() {
    const currency = baseCurrencyCode(currencies);
    setEditing(null);
    setForm({ ...blankTemplate, currency });
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(record: CostTemplateRecord) {
    setEditing(record);
    setForm({
      name: record.name,
      description: record.description || "",
      default_bml_tax: String(record.default_bml_tax),
      default_import_tax: String(record.default_import_tax),
      default_shipping_cost: String(record.default_shipping_cost),
      default_additional_cost: String(record.default_additional_cost),
      default_margin_percent: String(record.default_margin_percent),
      currency: record.currency,
      is_active: record.is_active,
    });
    setFormError("");
    setFormOpen(true);
  }

  function closeForm() {
    setEditing(null);
    setForm(blankTemplate);
    setFormError("");
    setFormOpen(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setSaving(true);

    const payload: CostTemplatePayload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      default_bml_tax: numberFrom(form.default_bml_tax),
      default_import_tax: numberFrom(form.default_import_tax),
      default_shipping_cost: numberFrom(form.default_shipping_cost),
      default_additional_cost: numberFrom(form.default_additional_cost),
      default_margin_percent: numberFrom(form.default_margin_percent),
      currency: form.currency.toUpperCase(),
      is_active: form.is_active,
    };

    try {
      if (editing) {
        await updateCostTemplate(editing.id, payload);
      } else {
        await createCostTemplate(payload);
      }
      closeForm();
      await load();
      notify(editing ? "Cost template updated." : "Cost template created.", "success");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to save cost template.";
      setFormError(message);
      notify(message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(record: CostTemplateRecord) {
    if (!window.confirm(`Deactivate ${record.name}?`)) {
      return;
    }
    try {
      await deleteCostTemplate(record.id);
      await load();
      notify("Cost template deactivated.", "success");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to deactivate cost template.";
      setError(message);
      notify(message, "error");
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Cost Templates</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Save repeatable taxes, shipping, additional costs, and target margin defaults.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={loading} variant="outline" onClick={load}>
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Template
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={cn(inputClass, "pl-9")}
              placeholder="Search templates"
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
          <CardTitle>Templates</CardTitle>
          <Badge variant="muted">{records.length} templates</Badge>
        </CardHeader>
        {loading ? (
          <CardContent className="space-y-3 p-4">
            {[0, 1, 2].map((item) => <div key={item} className="h-14 animate-pulse rounded-md bg-muted" />)}
          </CardContent>
        ) : records.length === 0 ? (
          <CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center">
            <Database className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No templates found</p>
          </CardContent>
        ) : (
          <div className="grid gap-3 p-4 lg:grid-cols-2">
            {records.map((record) => (
              <div key={record.id} className="rounded-md border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{record.name}</p>
                      <Badge variant={record.is_active ? "success" : "muted"}>
                        {record.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {record.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">{record.description}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button aria-label="Edit template" size="icon" variant="ghost" onClick={() => openEdit(record)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button aria-label="Deactivate template" size="icon" variant="ghost" onClick={() => deactivate(record)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Metric label="BML / payment tax" value={formatCurrency(record.default_bml_tax, record.currency)} />
                  <Metric label="Import tax" value={formatCurrency(record.default_import_tax, record.currency)} />
                  <Metric label="Shipping" value={formatCurrency(record.default_shipping_cost, record.currency)} />
                  <Metric label="Additional" value={formatCurrency(record.default_additional_cost, record.currency)} />
                  <Metric label="Margin" value={`${Number(record.default_margin_percent).toFixed(2)}%`} />
                  <Metric label="Updated" value={formatDate(record.updated_at)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-card shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between gap-3 border-b bg-card p-5">
              <h3 className="text-lg font-semibold">{editing ? "Edit Cost Template" : "New Cost Template"}</h3>
              <Button aria-label="Close" size="icon" variant="ghost" onClick={closeForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <form className="grid gap-4 p-5 sm:grid-cols-2" onSubmit={submit}>
              {formError ? (
                <div className="rounded-md border border-orange-500/30 bg-orange-500/5 p-3 text-sm text-orange-700 dark:text-orange-300 sm:col-span-2">
                  {formError}
                </div>
              ) : null}
              <Field label="Template name">
                <input required className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </Field>
              <Field label="Currency">
                <select className={inputClass} value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}>
                  {activeCurrencyCodes.map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Description">
                  <textarea className={textareaClass} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                </Field>
              </div>
              <Field label="Default BML / payment tax">
                <input min="0" step="0.01" type="number" className={inputClass} value={form.default_bml_tax} onChange={(event) => setForm({ ...form, default_bml_tax: event.target.value })} />
              </Field>
              <Field label="Default import tax">
                <input min="0" step="0.01" type="number" className={inputClass} value={form.default_import_tax} onChange={(event) => setForm({ ...form, default_import_tax: event.target.value })} />
              </Field>
              <Field label="Default shipping">
                <input min="0" step="0.01" type="number" className={inputClass} value={form.default_shipping_cost} onChange={(event) => setForm({ ...form, default_shipping_cost: event.target.value })} />
              </Field>
              <Field label="Default additional">
                <input min="0" step="0.01" type="number" className={inputClass} value={form.default_additional_cost} onChange={(event) => setForm({ ...form, default_additional_cost: event.target.value })} />
              </Field>
              <Field label="Default margin %">
                <input min="0" max="99" step="0.01" type="number" className={inputClass} value={form.default_margin_percent} onChange={(event) => setForm({ ...form, default_margin_percent: event.target.value })} />
              </Field>
              <label className="flex h-9 items-center gap-2 self-end rounded-md border px-3 text-sm">
                <input checked={form.is_active} type="checkbox" onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
                Active
              </label>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button disabled={saving} type="button" variant="outline" onClick={closeForm}>Cancel</Button>
                <Button disabled={saving} type="submit">{saving ? "Saving..." : "Save Template"}</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/30 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
