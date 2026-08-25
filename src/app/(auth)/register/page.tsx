'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input, Button, Form } from '@/components/ui';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'player' as 'player' | 'master',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Limpar erro do campo ao digitar
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    // Validação local
    if (formData.password !== formData.confirmPassword) {
      setErrors({ confirmPassword: 'As senhas não coincidem' });
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: formData.displayName,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          // Erros de validação do Zod
          const fieldErrors: Record<string, string> = {};
          data.errors.forEach((err: { path: string[]; message: string }) => {
            fieldErrors[err.path[0]] = err.message;
          });
          setErrors(fieldErrors);
        } else {
          setErrors({ general: data.error || 'Erro ao criar conta' });
        }
        return;
      }

      const targetUrl = data.data?.redirect || (data.data?.role === "master" ? "/master" : "/player");
      window.location.href = targetUrl;
    } catch {
      setErrors({ general: 'Erro de conexão. Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dominant-deep text-secondary-pure px-4 py-8">
      <div className="max-w-md w-full space-y-8 bg-secondary-card p-8 rounded-xl border border-dominant-border shadow-xl">
        <div>
          <h1 className="text-3xl font-bold text-center text-secondary-pure">
            Criar Conta
          </h1>
          <p className="mt-2 text-center text-sm text-secondary-muted">
            Crie sua conta no Libmork para começar a jogar
          </p>
        </div>

        <Form onSubmit={handleSubmit} error={errors.general}>
          <Input
            label="Nome"
            name="displayName"
            type="text"
            value={formData.displayName}
            onChange={handleChange}
            error={errors.displayName}
            required
            autoComplete="name"
            disabled={isLoading}
          />

          <Input
            label="E-mail"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
            required
            autoComplete="email"
            disabled={isLoading}
          />

          <Input
            label="Senha"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            error={errors.password}
            required
            autoComplete="new-password"
            disabled={isLoading}
          />

          <Input
            label="Confirmar Senha"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            error={errors.confirmPassword}
            required
            autoComplete="new-password"
            disabled={isLoading}
          />

          <div>
            <label className="block text-sm font-medium text-secondary-muted mb-1">
              Tipo de conta
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, role: "player" }))}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  formData.role === "player"
                    ? "border-accent bg-accent text-secondary-pure"
                    : "border-secondary-border bg-dominant-dark text-secondary-muted hover:border-accent-vibrant hover:text-secondary-pure"
                }`}
              >
                Jogador
              </button>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, role: "master" }))}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  formData.role === "master"
                    ? "border-accent bg-accent text-secondary-pure shadow-[0_0_10px_rgba(147,51,234,0.3)]"
                    : "border-secondary-border bg-dominant-dark text-secondary-muted hover:border-accent-vibrant hover:text-secondary-pure"
                }`}
              >
                Mestre
              </button>
            </div>
          </div>

          <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
            Criar Conta
          </Button>
        </Form>

        <p className="text-center text-sm text-secondary-muted">
          Já tem uma conta?{' '}
          <Link href="/login" className="font-medium text-accent hover:text-accent-hover transition-colors">
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  );
}
