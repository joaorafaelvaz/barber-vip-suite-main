import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Globe, LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

export function Header() {
  const { profile, signOut } = useAuth();
  const { t, language, setLanguage, languages } = useI18n();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    await signOut();
    toast({
      title: t('auth.logoutSuccess'),
    });
    navigate('/auth');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const currentLang = languages.find((l) => l.code === language);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-border bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <SidebarTrigger className="-ml-1 text-foreground hover:text-primary" />
      
      <div className="flex-1" />

      {/* Language Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/50"
          >
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">{currentLang?.flag}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-card border-border">
          <DropdownMenuLabel className="text-muted-foreground">{t('perfil.idioma')}</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border" />
          {languages.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`text-foreground hover:bg-primary/10 hover:text-primary cursor-pointer ${language === lang.code ? 'bg-primary/10 text-primary' : ''}`}
            >
              <span className="mr-2">{lang.flag}</span>
              {lang.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* User Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-2 text-foreground hover:bg-muted/50"
          >
            <Avatar className="h-7 w-7 border border-primary/30">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                {profile?.display_name ? getInitials(profile.display_name) : 'U'}
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline max-w-[150px] truncate text-foreground">
              {profile?.display_name || 'Usuário'}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-card border-border">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium text-foreground">{profile?.display_name}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {profile?.role_base?.replace('_', ' ')}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuItem 
            onClick={() => navigate('/app/perfil')}
            className="text-foreground hover:bg-primary/10 hover:text-primary cursor-pointer"
          >
            <User className="mr-2 h-4 w-4" />
            {t('nav.perfil')}
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuItem 
            onClick={handleLogout} 
            className="text-destructive hover:bg-destructive/10 cursor-pointer"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t('auth.logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
