"use client";

import { useCallback, useEffect, useState } from "react";
import { ATTRIBUTES, SPELL_USE_TYPES } from "@/lib/utils/constants";
import type { ContentType } from "@/lib/validators/content";
import { Button, Form, Input } from "@/components/ui";

type FieldDef = {
  name: string;
  label: string;
  type: "text" | "number" | "textarea" | "select";
  required?: boolean;
  options?: readonly string[];
  min?: number;
  max?: number;
  placeholder?: string;
};

type TypeConfig = {
  label: string;
  fields: FieldDef[];
  showInList: string[];
};

const TYPE_CONFIGS: Record<ContentType, TypeConfig> = {
  skills: {
    label: "Perícias",
    fields: [
      { name: "name", label: "Nome", type: "text", required: true },
      { name: "description", label: "Descrição", type: "textarea" },
      { name: "rollExpression", label: "Expressão de Rolagem", type: "text", placeholder: "1d20 + destreza" },
      { name: "keyAttribute", label: "Atributo Chave", type: "select", options: ATTRIBUTES, required: true },
    ],
    showInList: ["keyAttribute", "rollExpression"],
  },
  spells: {
    label: "Magias",
    fields: [
      { name: "name", label: "Nome", type: "text", required: true },
      { name: "circle", label: "Círculo (1-9)", type: "number", min: 1, max: 9, required: true },
      { name: "manaCost", label: "Custo de Mana", type: "number", min: 0, required: true },
      { name: "useType", label: "Tipo de Uso", type: "select", options: SPELL_USE_TYPES },
      { name: "duration", label: "Duração", type: "text" },
      { name: "description", label: "Descrição", type: "textarea" },
      { name: "extraEffect", label: "Efeito Extra", type: "textarea" },
      { name: "actionCostOverride", label: "Custo de Ações (override, 0-3)", type: "number", min: 0, max: 3 },
    ],
    showInList: ["circle", "manaCost"],
  },
  items: {
    label: "Itens",
    fields: [
      { name: "name", label: "Nome", type: "text", required: true },
      { name: "description", label: "Descrição", type: "textarea" },
      { name: "qualityDescription", label: "Qualidade", type: "textarea" },
      { name: "counterpointDescription", label: "Contraponto", type: "textarea" },
    ],
    showInList: ["description"],
  },
  conditions: {
    label: "Condições",
    fields: [
      { name: "name", label: "Nome", type: "text", required: true },
      { name: "description", label: "Descrição", type: "textarea" },
    ],
    showInList: ["description"],
  },
};

const CONTENT_TYPE_ORDER: ContentType[] = ["skills", "spells", "items", "conditions"];

type ContentManagerProps = {
  basePath: string;
  title: string;
};

type Item = Record<string, unknown>;

function toFormValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

export function ContentManager({ basePath, title }: ContentManagerProps) {
  const [activeType, setActiveType] = useState<ContentType>("skills");
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const config = TYPE_CONFIGS[activeType];

  const loadItems = useCallback(async () => {
    try {
      const response = await fetch(`${basePath}/${activeType}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao carregar conteúdo");
        return;
      }

      setItems(data.data);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, [basePath, activeType]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${basePath}/${activeType}`);
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          setError(data.error || "Erro ao carregar conteúdo");
          return;
        }

        setItems(data.data);
      } catch {
        if (!cancelled) {
          setError("Erro de conexão. Tente novamente.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [basePath, activeType]);

  const buildPayload = (source: Record<string, string>) => {
    const payload: Record<string, unknown> = {};

    for (const field of config.fields) {
      const value = source[field.name];
      if (field.type === "number") {
        if (value === "" || value === undefined) continue;
        payload[field.name] = Number(value);
      } else if (value !== "" && value !== undefined) {
        payload[field.name] = value;
      }
    }

    return payload;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsCreating(true);

    try {
      const response = await fetch(`${basePath}/${activeType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(formData)),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao criar conteúdo");
        return;
      }

      setFormData({});
      await loadItems();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsCreating(false);
    }
  };

  const startEditing = (item: Item) => {
    const initial: Record<string, string> = {};
    for (const field of config.fields) {
      initial[field.name] = toFormValue(item[field.name]);
    }
    setEditData(initial);
    setEditingId(item.id as string);
  };

  const handleSaveEdit = async (id: string) => {
    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch(`${basePath}/${activeType}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(editData)),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao salvar alterações");
        return;
      }

      setEditingId(null);
      setEditData({});
      await loadItems();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Excluir esta ${config.label.toLowerCase().replace(/s$/, "")}?`)) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(`${basePath}/${activeType}/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao excluir conteúdo");
        return;
      }

      if (editingId === id) {
        setEditingId(null);
      }
      await loadItems();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
  };

  const renderFields = (
    data: Record<string, string>,
    onChange: (name: string, value: string) => void,
    disabled: boolean,
    prefix: string
  ) =>
    config.fields.map((field) => {
      const key = `${prefix}-${field.name}`;
      if (field.type === "textarea") {
        return (
          <div key={key}>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              {field.label}
            </label>
            <textarea
              value={data[field.name] || ""}
              onChange={(e) => onChange(field.name, e.target.value)}
              required={field.required}
              placeholder={field.placeholder}
              disabled={disabled}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent disabled:bg-gray-900"
              rows={2}
            />
          </div>
        );
      }
      if (field.type === "select") {
        return (
          <div key={key}>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              {field.label}
            </label>
            <select
              value={data[field.name] || ""}
              onChange={(e) => onChange(field.name, e.target.value)}
              required={field.required}
              disabled={disabled}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            >
              <option value="">Selecione</option>
              {field.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        );
      }
      return (
        <Input
          key={key}
          label={field.label}
          name={`${prefix}-${field.name}`}
          type={field.type}
          min={field.min}
          max={field.max}
          placeholder={field.placeholder}
          value={data[field.name] || ""}
          onChange={(e) => onChange(field.name, e.target.value)}
          required={field.required}
          disabled={disabled}
          className="bg-gray-950 text-white"
        />
      );
    });

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold text-white">{title}</h2>

      <div className="mb-4 flex flex-wrap gap-2">
        {CONTENT_TYPE_ORDER.map((type) => (
          <button
            key={type}
            onClick={() => {
              setActiveType(type);
              setFormData({});
              setEditingId(null);
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeType === type
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {TYPE_CONFIGS[type].label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h3 className="mb-3 font-semibold text-white">Nova {config.label.replace(/s$/, "")}</h3>
          <Form onSubmit={handleCreate} error={undefined}>
            {renderFields(formData, (name, value) => setFormData((prev) => ({ ...prev, [name]: value })), isCreating, "create")}
            <Button type="submit" variant="master" isLoading={isCreating}>
              Criar
            </Button>
          </Form>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h3 className="mb-3 font-semibold text-white">
            {config.label} ({items.length})
          </h3>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-700 border-t-purple-600" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum conteúdo cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id as string}
                  className="rounded-lg border border-gray-800 bg-gray-950"
                >
                  <div className="flex items-start justify-between p-3">
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() =>
                          editingId === item.id
                            ? setEditingId(null)
                            : startEditing(item)
                        }
                        className="text-left font-semibold text-white hover:text-purple-300"
                      >
                        {item.name as string} {editingId === item.id ? "−" : "✎"}
                      </button>
                      <div className="mt-1 space-y-0.5">
                        {config.showInList.map((field) => {
                          const value = item[field];
                          if (value === null || value === undefined || value === "") return null;
                          return (
                            <p key={field} className="text-xs text-gray-400">
                              {field}: {String(value)}
                            </p>
                          );
                        })}
                        {item.campaignId ? (
                          <p className="text-xs text-purple-400">Privado da campanha</p>
                        ) : (
                          <p className="text-xs text-gray-500">Global</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(item.id as string)}
                      className="ml-4 shrink-0 text-sm text-red-400 hover:text-red-300"
                    >
                      Excluir
                    </button>
                  </div>

                  {editingId === item.id && (
                    <div className="space-y-3 border-t border-gray-800 p-3">
                      <p className="text-sm font-semibold text-gray-300">
                        Editar {config.label.replace(/s$/, "")}
                      </p>
                      {renderFields(editData, (name, value) => setEditData((prev) => ({ ...prev, [name]: value })), isSaving, "edit")}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="master"
                          isLoading={isSaving}
                          onClick={() => handleSaveEdit(item.id as string)}
                        >
                          Salvar
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
