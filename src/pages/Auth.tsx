import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Auth() {
  const navigate = useNavigate();
  const { user, signIn, loading: authLoading } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      navigate('/app/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const onSubmit = async (data: LoginForm) => {
    setIsSubmitting(true);

    try {
      const { error } = await signIn(data.email, data.password);

      if (error) {
        toast({
          variant: 'destructive',
          title: t('auth.loginError'),
          description: error.message || t('auth.invalidCredentials'),
        });
        setIsSubmitting(false);
      }
      // Sucesso: spinner mantido até o componente desmontar via navigate (useEffect)
    } catch {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-dark">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-dark p-4 relative">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-success/5 pointer-events-none" />
      
      <div className="w-full max-w-md space-y-8 relative z-10">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gradient-gold">
            {t('app.name')}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t('app.tagline')}
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-border bg-card shadow-gold-glow">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-semibold text-foreground">
              {t('auth.welcome')}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {t('auth.loginSubtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">{t('auth.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('placeholders.email')}
                  autoComplete="email"
                  {...register('email')}
                  className={`bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary ${errors.email ? 'border-destructive' : ''}`}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">{t('auth.password')}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    {...register('password')}
                    className={`bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary pr-10 ${errors.password ? 'border-destructive' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-gold text-primary-foreground font-semibold shadow-gold hover:shadow-gold-glow transition-all duration-200"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('auth.loggingIn')}
                  </>
                ) : (
                  t('auth.login')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} VIP Data. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
