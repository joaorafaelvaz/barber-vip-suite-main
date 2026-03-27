export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          diff: Json | null
          entity: string
          entity_id: string | null
          id: string
          meta: Json | null
          org_id: string | null
          unit_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          diff?: Json | null
          entity: string
          entity_id?: string | null
          id?: string
          meta?: Json | null
          org_id?: string | null
          unit_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          diff?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
          meta?: Json | null
          org_id?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "app_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_audit_log_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "app_units"
            referencedColumns: ["id"]
          },
        ]
      }
      app_orgs: {
        Row: {
          created_at: string
          id: string
          nome: string
          status: string
          tenant_key: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          status?: string
          tenant_key?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          status?: string
          tenant_key?: string | null
        }
        Relationships: []
      }
      app_permissions: {
        Row: {
          action: Database["public"]["Enums"]["app_permission_action"]
          created_at: string
          description: string | null
          id: string
          module: string
          screen_key: string
        }
        Insert: {
          action: Database["public"]["Enums"]["app_permission_action"]
          created_at?: string
          description?: string | null
          id?: string
          module: string
          screen_key: string
        }
        Update: {
          action?: Database["public"]["Enums"]["app_permission_action"]
          created_at?: string
          description?: string | null
          id?: string
          module?: string
          screen_key?: string
        }
        Relationships: []
      }
      app_role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "app_permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "app_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_roles: {
        Row: {
          base_role: Database["public"]["Enums"]["app_role_base"]
          created_at: string
          description: string | null
          id: string
          is_system: boolean | null
          name: string
          org_id: string | null
          updated_at: string
        }
        Insert: {
          base_role?: Database["public"]["Enums"]["app_role_base"]
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          org_id?: string | null
          updated_at?: string
        }
        Update: {
          base_role?: Database["public"]["Enums"]["app_role_base"]
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          org_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "app_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      app_security_settings: {
        Row: {
          allow_mfa_for_others: boolean
          created_at: string
          id: string
          org_id: string | null
          require_mfa_for_master: boolean
          session_policy: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          allow_mfa_for_others?: boolean
          created_at?: string
          id?: string
          org_id?: string | null
          require_mfa_for_master?: boolean
          session_policy?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          allow_mfa_for_others?: boolean
          created_at?: string
          id?: string
          org_id?: string | null
          require_mfa_for_master?: boolean
          session_policy?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_security_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "app_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_security_settings_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "app_units"
            referencedColumns: ["id"]
          },
        ]
      }
      app_units: {
        Row: {
          created_at: string
          id: string
          nome: string
          org_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          org_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          org_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_units_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "app_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      app_user_grants: {
        Row: {
          created_at: string
          grant_type: Database["public"]["Enums"]["app_grant_type"]
          id: string
          payload: Json | null
          ref_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          grant_type: Database["public"]["Enums"]["app_grant_type"]
          id?: string
          payload?: Json | null
          ref_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          grant_type?: Database["public"]["Enums"]["app_grant_type"]
          id?: string
          payload?: Json | null
          ref_id?: string
          user_id?: string
        }
        Relationships: []
      }
      app_user_profiles: {
        Row: {
          colaborador_id: string | null
          created_at: string
          display_name: string
          is_active: boolean
          login_alias: string | null
          org_id: string | null
          preferred_language: string | null
          role_base: Database["public"]["Enums"]["app_role_base"]
          unit_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          colaborador_id?: string | null
          created_at?: string
          display_name: string
          is_active?: boolean
          login_alias?: string | null
          org_id?: string | null
          preferred_language?: string | null
          role_base?: Database["public"]["Enums"]["app_role_base"]
          unit_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          colaborador_id?: string | null
          created_at?: string
          display_name?: string
          is_active?: boolean
          login_alias?: string | null
          org_id?: string | null
          preferred_language?: string | null
          role_base?: Database["public"]["Enums"]["app_role_base"]
          unit_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_user_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "app_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_user_profiles_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "app_units"
            referencedColumns: ["id"]
          },
        ]
      }
      app_user_roles: {
        Row: {
          created_at: string
          granted_at: string
          granted_by: string | null
          id: string
          role_id: string
          scope_org_id: string | null
          scope_unit_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          role_id: string
          scope_org_id?: string | null
          scope_unit_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          role_id?: string
          scope_org_id?: string | null
          scope_unit_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "app_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_user_roles_scope_org_id_fkey"
            columns: ["scope_org_id"]
            isOneToOne: false
            referencedRelation: "app_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_user_roles_scope_unit_id_fkey"
            columns: ["scope_unit_id"]
            isOneToOne: false
            referencedRelation: "app_units"
            referencedColumns: ["id"]
          },
        ]
      }
      barbearia_config: {
        Row: {
          chave: string
          id: string
          updated_at: string | null
          valor: Json
        }
        Insert: {
          chave: string
          id?: string
          updated_at?: string | null
          valor: Json
        }
        Update: {
          chave?: string
          id?: string
          updated_at?: string | null
          valor?: Json
        }
        Relationships: []
      }
      bonus_faixas: {
        Row: {
          bonus_valor: number
          created_at: string
          faixa_ordem: number
          id: string
          nome: string | null
          regra_id: string
          valor_maximo: number | null
          valor_minimo: number
        }
        Insert: {
          bonus_valor: number
          created_at?: string
          faixa_ordem: number
          id?: string
          nome?: string | null
          regra_id: string
          valor_maximo?: number | null
          valor_minimo?: number
        }
        Update: {
          bonus_valor?: number
          created_at?: string
          faixa_ordem?: number
          id?: string
          nome?: string | null
          regra_id?: string
          valor_maximo?: number | null
          valor_minimo?: number
        }
        Relationships: [
          {
            foreignKeyName: "bonus_faixas_regra_id_fkey"
            columns: ["regra_id"]
            isOneToOne: false
            referencedRelation: "bonus_regras"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_historico_resultado: {
        Row: {
          ano: number
          atingiu: boolean
          bonus_calculado: number
          colaborador_id: string
          colaborador_nome: string | null
          created_at: string
          detalhes: Json | null
          id: string
          kpi_realizado: number | null
          mes: number
          meta: number | null
          regra_id: string
        }
        Insert: {
          ano: number
          atingiu?: boolean
          bonus_calculado?: number
          colaborador_id: string
          colaborador_nome?: string | null
          created_at?: string
          detalhes?: Json | null
          id?: string
          kpi_realizado?: number | null
          mes: number
          meta?: number | null
          regra_id: string
        }
        Update: {
          ano?: number
          atingiu?: boolean
          bonus_calculado?: number
          colaborador_id?: string
          colaborador_nome?: string | null
          created_at?: string
          detalhes?: Json | null
          id?: string
          kpi_realizado?: number | null
          mes?: number
          meta?: number | null
          regra_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_historico_resultado_regra_id_fkey"
            columns: ["regra_id"]
            isOneToOne: false
            referencedRelation: "bonus_regras"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_regras: {
        Row: {
          ativo: boolean
          base_calculo: string | null
          bonus_valor: number | null
          colaborador_id: string | null
          created_at: string
          depende_meta: boolean
          descricao_regra: string | null
          id: string
          item_alvo: string | null
          kpi_key: string | null
          meta_operador: string | null
          meta_valor: number | null
          nome_bonus: string
          tipo_bonus: string
          updated_at: string
          usa_escalonamento: boolean
        }
        Insert: {
          ativo?: boolean
          base_calculo?: string | null
          bonus_valor?: number | null
          colaborador_id?: string | null
          created_at?: string
          depende_meta?: boolean
          descricao_regra?: string | null
          id?: string
          item_alvo?: string | null
          kpi_key?: string | null
          meta_operador?: string | null
          meta_valor?: number | null
          nome_bonus: string
          tipo_bonus: string
          updated_at?: string
          usa_escalonamento?: boolean
        }
        Update: {
          ativo?: boolean
          base_calculo?: string | null
          bonus_valor?: number | null
          colaborador_id?: string | null
          created_at?: string
          depende_meta?: boolean
          descricao_regra?: string | null
          id?: string
          item_alvo?: string | null
          kpi_key?: string | null
          meta_operador?: string | null
          meta_valor?: number | null
          nome_bonus?: string
          tipo_bonus?: string
          updated_at?: string
          usa_escalonamento?: boolean
        }
        Relationships: []
      }
      bonus_regras_periodos: {
        Row: {
          ano: number
          created_at: string
          id: string
          mes: number
          regra_id: string
        }
        Insert: {
          ano: number
          created_at?: string
          id?: string
          mes: number
          regra_id: string
        }
        Update: {
          ano?: number
          created_at?: string
          id?: string
          mes?: number
          regra_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_regras_periodos_regra_id_fkey"
            columns: ["regra_id"]
            isOneToOne: false
            referencedRelation: "bonus_regras"
            referencedColumns: ["id"]
          },
        ]
      }
      caixas: {
        Row: {
          caixa_id: string
          caixa_nome: string | null
          dim_created_at: string
          dim_updated_at: string
          first_seen: string | null
          last_seen: string | null
        }
        Insert: {
          caixa_id: string
          caixa_nome?: string | null
          dim_created_at?: string
          dim_updated_at?: string
          first_seen?: string | null
          last_seen?: string | null
        }
        Update: {
          caixa_id?: string
          caixa_nome?: string | null
          dim_created_at?: string
          dim_updated_at?: string
          first_seen?: string | null
          last_seen?: string | null
        }
        Relationships: []
      }
      classificacao_produtos: {
        Row: {
          grupo_de_produto: string | null
          imported_at: string
          produto: string
          servicos_ou_produtos: string | null
        }
        Insert: {
          grupo_de_produto?: string | null
          imported_at?: string
          produto: string
          servicos_ou_produtos?: string | null
        }
        Update: {
          grupo_de_produto?: string | null
          imported_at?: string
          produto?: string
          servicos_ou_produtos?: string | null
        }
        Relationships: []
      }
      cliente_status_snapshot: {
        Row: {
          atendimentos_periodo: number | null
          cadencia_bruta_dias: number | null
          cadencia_dias: number | null
          cadencia_metodo: string | null
          cliente_id: string
          cliente_nome: string | null
          colaborador_id_ultimo: string | null
          colaborador_nome_ultimo: string | null
          created_at: string
          dias_sem_vir: number | null
          qtd_visitas_periodo: number | null
          snapshot_date: string
          status_cliente: string | null
          telefone: string | null
          ultima_visita_dia: string | null
          ultima_visita_ts: string | null
          valor_periodo: number | null
        }
        Insert: {
          atendimentos_periodo?: number | null
          cadencia_bruta_dias?: number | null
          cadencia_dias?: number | null
          cadencia_metodo?: string | null
          cliente_id: string
          cliente_nome?: string | null
          colaborador_id_ultimo?: string | null
          colaborador_nome_ultimo?: string | null
          created_at?: string
          dias_sem_vir?: number | null
          qtd_visitas_periodo?: number | null
          snapshot_date: string
          status_cliente?: string | null
          telefone?: string | null
          ultima_visita_dia?: string | null
          ultima_visita_ts?: string | null
          valor_periodo?: number | null
        }
        Update: {
          atendimentos_periodo?: number | null
          cadencia_bruta_dias?: number | null
          cadencia_dias?: number | null
          cadencia_metodo?: string | null
          cliente_id?: string
          cliente_nome?: string | null
          colaborador_id_ultimo?: string | null
          colaborador_nome_ultimo?: string | null
          created_at?: string
          dias_sem_vir?: number | null
          qtd_visitas_periodo?: number | null
          snapshot_date?: string
          status_cliente?: string | null
          telefone?: string | null
          ultima_visita_dia?: string | null
          ultima_visita_ts?: string | null
          valor_periodo?: number | null
        }
        Relationships: []
      }
      colaborador_folgas: {
        Row: {
          colaborador_id: string
          created_at: string | null
          data: string
          id: string
          motivo: string | null
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          colaborador_id: string
          created_at?: string | null
          data: string
          id?: string
          motivo?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          colaborador_id?: string
          created_at?: string | null
          data?: string
          id?: string
          motivo?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_colaborador_folgas_colab"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "dimensao_colaboradores"
            referencedColumns: ["colaborador_id"]
          },
        ]
      }
      colaborador_folgas_fixas: {
        Row: {
          ativo: boolean | null
          colaborador_id: string
          created_at: string | null
          dia_semana: number
          id: string
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          ativo?: boolean | null
          colaborador_id: string
          created_at?: string | null
          dia_semana: number
          id?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Update: {
          ativo?: boolean | null
          colaborador_id?: string
          created_at?: string | null
          dia_semana?: number
          id?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_colaborador_folgas_fixas_colab"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "dimensao_colaboradores"
            referencedColumns: ["colaborador_id"]
          },
        ]
      }
      dimensao_clientes: {
        Row: {
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          cliente_id: string
          cliente_nome: string | null
          consumo: number | null
          dim_created_at: string
          dim_updated_at: string
          estado: string | null
          first_seen: string | null
          last_seen: string | null
          nascimento: string | null
          numero: string | null
          origem: string | null
          pontuacao: number | null
          rua: string | null
          score_updated_at: string | null
          telefone: string | null
          telefone_digits: string | null
          ultimo_colaborador: string | null
          ultimo_colaborador_id: string | null
          ultimo_colaborador_nome: string | null
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id: string
          cliente_nome?: string | null
          consumo?: number | null
          dim_created_at?: string
          dim_updated_at?: string
          estado?: string | null
          first_seen?: string | null
          last_seen?: string | null
          nascimento?: string | null
          numero?: string | null
          origem?: string | null
          pontuacao?: number | null
          rua?: string | null
          score_updated_at?: string | null
          telefone?: string | null
          telefone_digits?: string | null
          ultimo_colaborador?: string | null
          ultimo_colaborador_id?: string | null
          ultimo_colaborador_nome?: string | null
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id?: string
          cliente_nome?: string | null
          consumo?: number | null
          dim_created_at?: string
          dim_updated_at?: string
          estado?: string | null
          first_seen?: string | null
          last_seen?: string | null
          nascimento?: string | null
          numero?: string | null
          origem?: string | null
          pontuacao?: number | null
          rua?: string | null
          score_updated_at?: string | null
          telefone?: string | null
          telefone_digits?: string | null
          ultimo_colaborador?: string | null
          ultimo_colaborador_id?: string | null
          ultimo_colaborador_nome?: string | null
        }
        Relationships: []
      }
      dimensao_colaboradores: {
        Row: {
          ativo: boolean
          colaborador_id: string
          colaborador_nome: string | null
          dim_created_at: string
          dim_updated_at: string
          first_seen: string | null
          last_seen: string | null
          tipo_colaborador: string | null
        }
        Insert: {
          ativo?: boolean
          colaborador_id: string
          colaborador_nome?: string | null
          dim_created_at?: string
          dim_updated_at?: string
          first_seen?: string | null
          last_seen?: string | null
          tipo_colaborador?: string | null
        }
        Update: {
          ativo?: boolean
          colaborador_id?: string
          colaborador_nome?: string | null
          dim_created_at?: string
          dim_updated_at?: string
          first_seen?: string | null
          last_seen?: string | null
          tipo_colaborador?: string | null
        }
        Relationships: []
      }
      dimensao_produtos: {
        Row: {
          classificacao_status: string
          classificacao_updated_at: string | null
          dim_created_at: string
          dim_updated_at: string
          first_seen: string | null
          grupo_de_produto: string | null
          last_seen: string | null
          produto: string
          servicos_ou_produtos: string | null
        }
        Insert: {
          classificacao_status?: string
          classificacao_updated_at?: string | null
          dim_created_at?: string
          dim_updated_at?: string
          first_seen?: string | null
          grupo_de_produto?: string | null
          last_seen?: string | null
          produto: string
          servicos_ou_produtos?: string | null
        }
        Update: {
          classificacao_status?: string
          classificacao_updated_at?: string | null
          dim_created_at?: string
          dim_updated_at?: string
          first_seen?: string | null
          grupo_de_produto?: string | null
          last_seen?: string | null
          produto?: string
          servicos_ou_produtos?: string | null
        }
        Relationships: []
      }
      faixas_comissao_periodo: {
        Row: {
          cor: string
          created_at: string
          faixa_ordem: number
          id: string
          nome: string
          percentual: number
          regra_id: string
          valor_maximo: number | null
          valor_minimo: number
        }
        Insert: {
          cor?: string
          created_at?: string
          faixa_ordem: number
          id?: string
          nome: string
          percentual: number
          regra_id: string
          valor_maximo?: number | null
          valor_minimo?: number
        }
        Update: {
          cor?: string
          created_at?: string
          faixa_ordem?: number
          id?: string
          nome?: string
          percentual?: number
          regra_id?: string
          valor_maximo?: number | null
          valor_minimo?: number
        }
        Relationships: [
          {
            foreignKeyName: "faixas_comissao_periodo_regra_id_fkey"
            columns: ["regra_id"]
            isOneToOne: false
            referencedRelation: "regras_comissao_periodo"
            referencedColumns: ["id"]
          },
        ]
      }
      feriados: {
        Row: {
          barbearia_fecha: boolean | null
          created_at: string | null
          data: string
          id: string
          nome: string
          tipo: string
        }
        Insert: {
          barbearia_fecha?: boolean | null
          created_at?: string | null
          data: string
          id?: string
          nome: string
          tipo?: string
        }
        Update: {
          barbearia_fecha?: boolean | null
          created_at?: string | null
          data?: string
          id?: string
          nome?: string
          tipo?: string
        }
        Relationships: []
      }
      finance_conciliacao: {
        Row: {
          created_at: string | null
          extrato_id: string | null
          id: string
          lancamento_id: string | null
          score_match: number | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          extrato_id?: string | null
          id?: string
          lancamento_id?: string | null
          score_match?: number | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          extrato_id?: string | null
          id?: string
          lancamento_id?: string | null
          score_match?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_conciliacao_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: false
            referencedRelation: "finance_extrato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_conciliacao_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "finance_lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_conciliacao_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "vw_finance_lancamentos_base"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_contas: {
        Row: {
          ativo: boolean | null
          banco: string | null
          ca_conta_id: string | null
          created_at: string | null
          id: string
          nome: string
          saldo_atualizado_em: string | null
          saldo_inicial: number | null
          tenant_id: string
          tipo: string
        }
        Insert: {
          ativo?: boolean | null
          banco?: string | null
          ca_conta_id?: string | null
          created_at?: string | null
          id?: string
          nome: string
          saldo_atualizado_em?: string | null
          saldo_inicial?: number | null
          tenant_id: string
          tipo: string
        }
        Update: {
          ativo?: boolean | null
          banco?: string | null
          ca_conta_id?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          saldo_atualizado_em?: string | null
          saldo_inicial?: number | null
          tenant_id?: string
          tipo?: string
        }
        Relationships: []
      }
      finance_extrato: {
        Row: {
          conciliado: boolean | null
          conta_id: string | null
          created_at: string | null
          data: string
          descricao: string
          id: string
          origem: string | null
          tenant_id: string
          valor: number
        }
        Insert: {
          conciliado?: boolean | null
          conta_id?: string | null
          created_at?: string | null
          data: string
          descricao: string
          id?: string
          origem?: string | null
          tenant_id: string
          valor: number
        }
        Update: {
          conciliado?: boolean | null
          conta_id?: string | null
          created_at?: string | null
          data?: string
          descricao?: string
          id?: string
          origem?: string | null
          tenant_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_extrato_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "finance_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_lancamentos: {
        Row: {
          ca_categoria: string | null
          ca_contato: string | null
          ca_grupo: string | null
          ca_id: string | null
          ca_ref_date: string | null
          ca_run_id: string | null
          ca_source_run_id: string | null
          conta_id: string | null
          created_at: string | null
          data_pagamento: string | null
          data_vencimento: string
          descricao: string
          id: string
          origem: string | null
          plano_conta_id: string | null
          status: string
          tenant_id: string
          tipo: string
          updated_at: string | null
          valor: number
        }
        Insert: {
          ca_categoria?: string | null
          ca_contato?: string | null
          ca_grupo?: string | null
          ca_id?: string | null
          ca_ref_date?: string | null
          ca_run_id?: string | null
          ca_source_run_id?: string | null
          conta_id?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          descricao: string
          id?: string
          origem?: string | null
          plano_conta_id?: string | null
          status?: string
          tenant_id: string
          tipo: string
          updated_at?: string | null
          valor: number
        }
        Update: {
          ca_categoria?: string | null
          ca_contato?: string | null
          ca_grupo?: string | null
          ca_id?: string | null
          ca_ref_date?: string | null
          ca_run_id?: string | null
          ca_source_run_id?: string | null
          conta_id?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string
          id?: string
          origem?: string | null
          plano_conta_id?: string | null
          status?: string
          tenant_id?: string
          tipo?: string
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_lancamentos_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "finance_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_lancamentos_plano_conta_id_fkey"
            columns: ["plano_conta_id"]
            isOneToOne: false
            referencedRelation: "finance_plano_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_pacotes: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          ordem: number | null
          tenant_id: string
          tipo: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
          ordem?: number | null
          tenant_id: string
          tipo?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          tenant_id?: string
          tipo?: string | null
        }
        Relationships: []
      }
      finance_plano_contas: {
        Row: {
          ativo: boolean | null
          ca_categoria_id: string | null
          classificacao: string | null
          codigo: string
          created_at: string | null
          dre_linha: string | null
          estrutura_grupo: string | null
          grupo: string | null
          id: string
          nome: string
          ordem: number | null
          pacote: string | null
          sinal: number | null
          subgrupo: string | null
          tenant_id: string
          tipo: string
        }
        Insert: {
          ativo?: boolean | null
          ca_categoria_id?: string | null
          classificacao?: string | null
          codigo: string
          created_at?: string | null
          dre_linha?: string | null
          estrutura_grupo?: string | null
          grupo?: string | null
          id?: string
          nome: string
          ordem?: number | null
          pacote?: string | null
          sinal?: number | null
          subgrupo?: string | null
          tenant_id: string
          tipo: string
        }
        Update: {
          ativo?: boolean | null
          ca_categoria_id?: string | null
          classificacao?: string | null
          codigo?: string
          created_at?: string | null
          dre_linha?: string | null
          estrutura_grupo?: string | null
          grupo?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          pacote?: string | null
          sinal?: number | null
          subgrupo?: string | null
          tenant_id?: string
          tipo?: string
        }
        Relationships: []
      }
      finance_recorrencias: {
        Row: {
          ativo: boolean | null
          conta_id: string | null
          created_at: string | null
          descricao: string
          dia_execucao: number
          frequencia: string
          id: string
          plano_conta_id: string | null
          tenant_id: string
          tipo: string
          valor: number
        }
        Insert: {
          ativo?: boolean | null
          conta_id?: string | null
          created_at?: string | null
          descricao: string
          dia_execucao?: number
          frequencia?: string
          id?: string
          plano_conta_id?: string | null
          tenant_id: string
          tipo: string
          valor: number
        }
        Update: {
          ativo?: boolean | null
          conta_id?: string | null
          created_at?: string | null
          descricao?: string
          dia_execucao?: number
          frequencia?: string
          id?: string
          plano_conta_id?: string | null
          tenant_id?: string
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_recorrencias_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "finance_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_recorrencias_plano_conta_id_fkey"
            columns: ["plano_conta_id"]
            isOneToOne: false
            referencedRelation: "finance_plano_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_transferencias: {
        Row: {
          ca_id: string | null
          ca_run_id: string | null
          conta_destino_id: string | null
          conta_origem_id: string | null
          created_at: string | null
          data_transferencia: string
          descricao: string | null
          id: string
          origem: string | null
          status: string | null
          tenant_id: string
          updated_at: string | null
          valor: number
        }
        Insert: {
          ca_id?: string | null
          ca_run_id?: string | null
          conta_destino_id?: string | null
          conta_origem_id?: string | null
          created_at?: string | null
          data_transferencia: string
          descricao?: string | null
          id?: string
          origem?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
          valor?: number
        }
        Update: {
          ca_id?: string | null
          ca_run_id?: string | null
          conta_destino_id?: string | null
          conta_origem_id?: string | null
          created_at?: string | null
          data_transferencia?: string
          descricao?: string | null
          id?: string
          origem?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_transferencias_conta_destino_id_fkey"
            columns: ["conta_destino_id"]
            isOneToOne: false
            referencedRelation: "finance_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transferencias_conta_origem_id_fkey"
            columns: ["conta_origem_id"]
            isOneToOne: false
            referencedRelation: "finance_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_contaazul_raw: {
        Row: {
          endpoint: string
          external_id: string | null
          id: number
          ingested_at: string
          page_number: number | null
          page_size: number | null
          payload: Json
          query_params: Json | null
          ref_date: string | null
          source: string
          source_run_id: string
          tenant_key: string | null
        }
        Insert: {
          endpoint: string
          external_id?: string | null
          id?: never
          ingested_at?: string
          page_number?: number | null
          page_size?: number | null
          payload: Json
          query_params?: Json | null
          ref_date?: string | null
          source?: string
          source_run_id?: string
          tenant_key?: string | null
        }
        Update: {
          endpoint?: string
          external_id?: string | null
          id?: never
          ingested_at?: string
          page_number?: number | null
          page_size?: number | null
          payload?: Json
          query_params?: Json | null
          ref_date?: string | null
          source?: string
          source_run_id?: string
          tenant_key?: string | null
        }
        Relationships: []
      }
      integrations_contaazul_tokens: {
        Row: {
          access_token: string | null
          created_at: string
          expires_at: string | null
          id: number
          raw: Json | null
          refresh_token: string | null
          scope: string | null
          tenant_key: string
          token_type: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          id?: never
          raw?: Json | null
          refresh_token?: string | null
          scope?: string | null
          tenant_key?: string
          token_type?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          id?: never
          raw?: Json | null
          refresh_token?: string | null
          scope?: string | null
          tenant_key?: string
          token_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mensagem_envios: {
        Row: {
          canal: string
          categoria: string
          cliente_id: string
          cliente_nome: string | null
          colaborador_id: string | null
          colaborador_nome: string | null
          created_at: string
          criado_por: string | null
          enviado: boolean
          enviado_em: string | null
          enviado_por: string | null
          id: string
          mensagem_final: string | null
          mensagem_sugerida: string | null
          observacao: string | null
          ref_date: string
          status_cliente: string
          telefone: string | null
          template_id: string | null
          updated_at: string
        }
        Insert: {
          canal?: string
          categoria: string
          cliente_id: string
          cliente_nome?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string | null
          created_at?: string
          criado_por?: string | null
          enviado?: boolean
          enviado_em?: string | null
          enviado_por?: string | null
          id?: string
          mensagem_final?: string | null
          mensagem_sugerida?: string | null
          observacao?: string | null
          ref_date: string
          status_cliente: string
          telefone?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          canal?: string
          categoria?: string
          cliente_id?: string
          cliente_nome?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string | null
          created_at?: string
          criado_por?: string | null
          enviado?: boolean
          enviado_em?: string | null
          enviado_por?: string | null
          id?: string
          mensagem_final?: string | null
          mensagem_sugerida?: string | null
          observacao?: string | null
          ref_date?: string
          status_cliente?: string
          telefone?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagem_envios_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "mensagem_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagem_templates: {
        Row: {
          ativo: boolean
          categoria: string
          codigo: string
          corpo: string
          created_at: string
          id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria: string
          codigo: string
          corpo: string
          created_at?: string
          id?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          codigo?: string
          corpo?: string
          created_at?: string
          id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      raiox_clientes_config: {
        Row: {
          config_json: Json
          created_at: string
          id: string
          org_id: string | null
          unit_id: string | null
          updated_at: string
          user_id: string
          version: string
        }
        Insert: {
          config_json?: Json
          created_at?: string
          id?: string
          org_id?: string | null
          unit_id?: string | null
          updated_at?: string
          user_id: string
          version?: string
        }
        Update: {
          config_json?: Json
          created_at?: string
          id?: string
          org_id?: string | null
          unit_id?: string | null
          updated_at?: string
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      regras_comissao_periodo: {
        Row: {
          ano: number
          colaborador_id: string | null
          created_at: string
          id: string
          mes: number
          percentual_fixo: number | null
          tipo: string
          updated_at: string
          usa_escalonamento: boolean
        }
        Insert: {
          ano: number
          colaborador_id?: string | null
          created_at?: string
          id?: string
          mes: number
          percentual_fixo?: number | null
          tipo: string
          updated_at?: string
          usa_escalonamento?: boolean
        }
        Update: {
          ano?: number
          colaborador_id?: string | null
          created_at?: string
          id?: string
          mes?: number
          percentual_fixo?: number | null
          tipo?: string
          updated_at?: string
          usa_escalonamento?: boolean
        }
        Relationships: []
      }
      relatorio_comentarios: {
        Row: {
          ano: number
          colaborador_id: string | null
          comentario: string
          created_at: string
          created_by: string
          id: string
          semana_fim: string
          semana_inicio: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ano: number
          colaborador_id?: string | null
          comentario: string
          created_at?: string
          created_by: string
          id?: string
          semana_fim: string
          semana_inicio: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          ano?: number
          colaborador_id?: string | null
          comentario?: string
          created_at?: string
          created_by?: string
          id?: string
          semana_fim?: string
          semana_inicio?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      relatorio_semanal_envios: {
        Row: {
          colaborador_id: string
          colaborador_nome: string | null
          created_at: string
          enviado_em: string
          enviado_por: string | null
          id: string
          mensagem_final: string
          notas: string | null
          semana_fim: string
          semana_inicio: string
          telefone: string | null
          template_id: string | null
        }
        Insert: {
          colaborador_id: string
          colaborador_nome?: string | null
          created_at?: string
          enviado_em?: string
          enviado_por?: string | null
          id?: string
          mensagem_final: string
          notas?: string | null
          semana_fim: string
          semana_inicio: string
          telefone?: string | null
          template_id?: string | null
        }
        Update: {
          colaborador_id?: string
          colaborador_nome?: string | null
          created_at?: string
          enviado_em?: string
          enviado_por?: string | null
          id?: string
          mensagem_final?: string
          notas?: string | null
          semana_fim?: string
          semana_inicio?: string
          telefone?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_semanal_envios_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "relatorio_semanal_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorio_semanal_templates: {
        Row: {
          ativo: boolean
          corpo: string
          created_at: string
          id: string
          nome: string
          padrao: boolean
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          corpo: string
          created_at?: string
          id?: string
          nome: string
          padrao?: boolean
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          corpo?: string
          created_at?: string
          id?: string
          nome?: string
          padrao?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      vendas_api_raw: {
        Row: {
          caixa_id: string | null
          caixa_nome: string | null
          cliente_id: string | null
          cliente_nome: string | null
          colaborador: string | null
          colaborador_id: string | null
          colaborador_nome: string | null
          convenio: string | null
          forma_pagamento: string | null
          id: number
          ingested_at: string
          payload: Json
          produto: string | null
          source: string
          source_run_id: string
          telefone: string | null
          valor_bruto: number | null
          valor_liquido: number | null
          venda_data_text: string | null
          venda_data_ts: string | null
          venda_id: string
        }
        Insert: {
          caixa_id?: string | null
          caixa_nome?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          colaborador?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string | null
          convenio?: string | null
          forma_pagamento?: string | null
          id?: number
          ingested_at?: string
          payload: Json
          produto?: string | null
          source?: string
          source_run_id?: string
          telefone?: string | null
          valor_bruto?: number | null
          valor_liquido?: number | null
          venda_data_text?: string | null
          venda_data_ts?: string | null
          venda_id: string
        }
        Update: {
          caixa_id?: string | null
          caixa_nome?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          colaborador?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string | null
          convenio?: string | null
          forma_pagamento?: string | null
          id?: number
          ingested_at?: string
          payload?: Json
          produto?: string | null
          source?: string
          source_run_id?: string
          telefone?: string | null
          valor_bruto?: number | null
          valor_liquido?: number | null
          venda_data_text?: string | null
          venda_data_ts?: string | null
          venda_id?: string
        }
        Relationships: []
      }
      vendas_api_raw_tmp: {
        Row: {
          caixa_id: string | null
          caixa_nome: string | null
          cliente_id: string | null
          cliente_nome: string | null
          colaborador: string | null
          colaborador_id: string | null
          colaborador_nome: string | null
          convenio: string | null
          forma_pagamento: string | null
          id: number
          ingested_at: string
          payload: Json
          produto: string | null
          source: string
          source_run_id: string
          telefone: string | null
          valor_bruto: number | null
          valor_liquido: number | null
          venda_data_text: string | null
          venda_data_ts: string | null
          venda_id: string
        }
        Insert: {
          caixa_id?: string | null
          caixa_nome?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          colaborador?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string | null
          convenio?: string | null
          forma_pagamento?: string | null
          id?: number
          ingested_at?: string
          payload: Json
          produto?: string | null
          source?: string
          source_run_id?: string
          telefone?: string | null
          valor_bruto?: number | null
          valor_liquido?: number | null
          venda_data_text?: string | null
          venda_data_ts?: string | null
          venda_id: string
        }
        Update: {
          caixa_id?: string | null
          caixa_nome?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          colaborador?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string | null
          convenio?: string | null
          forma_pagamento?: string | null
          id?: number
          ingested_at?: string
          payload?: Json
          produto?: string | null
          source?: string
          source_run_id?: string
          telefone?: string | null
          valor_bruto?: number | null
          valor_liquido?: number | null
          venda_data_text?: string | null
          venda_data_ts?: string | null
          venda_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      vw_ca_contas_financeiras_base: {
        Row: {
          agencia: string | null
          ativo: boolean | null
          atualizado_em: string | null
          banco: string | null
          ca_conta_id: string | null
          codigo_banco: string | null
          conta_padrao: boolean | null
          nome: string | null
          numero: string | null
          tenant_key: string | null
          tipo: string | null
        }
        Relationships: []
      }
      vw_ca_lancamentos_base: {
        Row: {
          ca_id: string | null
          categoria: string | null
          categoria_id: string | null
          centros_de_custo: Json | null
          contato: string | null
          data_competencia: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string | null
          endpoint: string | null
          grupo: string | null
          ingested_at: string | null
          ref_date: string | null
          source_run_id: string | null
          status: string | null
          status_ca: string | null
          tenant_key: string | null
          tipo: string | null
          valor_aberto: number | null
          valor_pago: number | null
          valor_total: number | null
        }
        Relationships: []
      }
      vw_ca_lancamentos_competencia: {
        Row: {
          categoria: string | null
          conta_financeira: string | null
          data_mov: string | null
          descricao: string | null
          endpoint: string | null
          external_id: string | null
          id: number | null
          ingested_at: string | null
          mes: string | null
          status: string | null
          status_traduzido: string | null
          tenant_key: string | null
          tipo: string | null
          valor_nao_pago: number | null
          valor_pago: number | null
          valor_total: number | null
        }
        Relationships: []
      }
      vw_ca_lancamentos_vencimento: {
        Row: {
          categoria: string | null
          conta_financeira: string | null
          data_mov: string | null
          descricao: string | null
          endpoint: string | null
          external_id: string | null
          id: number | null
          ingested_at: string | null
          mes: string | null
          status: string | null
          status_traduzido: string | null
          tenant_key: string | null
          tipo: string | null
          valor_nao_pago: number | null
          valor_pago: number | null
          valor_total: number | null
        }
        Relationships: []
      }
      vw_ca_raw_contas_financeiras: {
        Row: {
          agencia: string | null
          ativo: boolean | null
          banco: string | null
          codigo_banco: string | null
          conta_id: string | null
          conta_padrao: boolean | null
          ingested_at: string | null
          nome: string | null
          numero: string | null
          payload_item: Json | null
          possui_config_boleto_bancario: boolean | null
          raw_id: number | null
          source_run_id: string | null
          tenant_key: string | null
          tipo: string | null
        }
        Relationships: []
      }
      vw_ca_raw_contas_pagar: {
        Row: {
          categoria_id: string | null
          categoria_nome: string | null
          categorias: Json | null
          centros_de_custo: Json | null
          data_competencia: string | null
          data_vencimento: string | null
          descricao: string | null
          fornecedor: string | null
          id_conta_azul: string | null
          ingested_at: string | null
          nao_pago: number | null
          pago: number | null
          payload_item: Json | null
          raw_id: number | null
          ref_date: string | null
          source_run_id: string | null
          status: string | null
          status_traduzido: string | null
          tenant_key: string | null
          total: number | null
        }
        Insert: {
          categoria_id?: never
          categoria_nome?: never
          categorias?: never
          centros_de_custo?: never
          data_competencia?: never
          data_vencimento?: never
          descricao?: never
          fornecedor?: never
          id_conta_azul?: never
          ingested_at?: string | null
          nao_pago?: never
          pago?: never
          payload_item?: never
          raw_id?: number | null
          ref_date?: string | null
          source_run_id?: string | null
          status?: never
          status_traduzido?: never
          tenant_key?: string | null
          total?: never
        }
        Update: {
          categoria_id?: never
          categoria_nome?: never
          categorias?: never
          centros_de_custo?: never
          data_competencia?: never
          data_vencimento?: never
          descricao?: never
          fornecedor?: never
          id_conta_azul?: never
          ingested_at?: string | null
          nao_pago?: never
          pago?: never
          payload_item?: never
          raw_id?: number | null
          ref_date?: string | null
          source_run_id?: string | null
          status?: never
          status_traduzido?: never
          tenant_key?: string | null
          total?: never
        }
        Relationships: []
      }
      vw_ca_raw_contas_receber: {
        Row: {
          categoria_id: string | null
          categoria_nome: string | null
          categorias: Json | null
          centros_de_custo: Json | null
          cliente: string | null
          data_competencia: string | null
          data_vencimento: string | null
          descricao: string | null
          id_conta_azul: string | null
          ingested_at: string | null
          nao_pago: number | null
          pago: number | null
          payload_item: Json | null
          raw_id: number | null
          ref_date: string | null
          source_run_id: string | null
          status: string | null
          status_traduzido: string | null
          tenant_key: string | null
          total: number | null
        }
        Insert: {
          categoria_id?: never
          categoria_nome?: never
          categorias?: never
          centros_de_custo?: never
          cliente?: never
          data_competencia?: never
          data_vencimento?: never
          descricao?: never
          id_conta_azul?: never
          ingested_at?: string | null
          nao_pago?: never
          pago?: never
          payload_item?: never
          raw_id?: number | null
          ref_date?: string | null
          source_run_id?: string | null
          status?: never
          status_traduzido?: never
          tenant_key?: string | null
          total?: never
        }
        Update: {
          categoria_id?: never
          categoria_nome?: never
          categorias?: never
          centros_de_custo?: never
          cliente?: never
          data_competencia?: never
          data_vencimento?: never
          descricao?: never
          id_conta_azul?: never
          ingested_at?: string | null
          nao_pago?: never
          pago?: never
          payload_item?: never
          raw_id?: number | null
          ref_date?: string | null
          source_run_id?: string | null
          status?: never
          status_traduzido?: never
          tenant_key?: string | null
          total?: never
        }
        Relationships: []
      }
      vw_clientes_resumo: {
        Row: {
          atendimentos_total: number | null
          cliente_id: string | null
          cliente_nome: string | null
          colaborador_id_ultimo: string | null
          colaborador_nome_ultimo: string | null
          primeira_visita: string | null
          telefone: string | null
          ticket_medio: number | null
          ultima_visita: string | null
          valor_total: number | null
        }
        Relationships: []
      }
      vw_finance_dre_base: {
        Row: {
          categoria: string | null
          categoria_tipo: string | null
          grupo: string | null
          mes: string | null
          subgrupo: string | null
          tenant_id: string | null
          total: number | null
        }
        Relationships: []
      }
      vw_finance_lancamentos_base: {
        Row: {
          categoria: string | null
          classificacao: string | null
          conta: string | null
          conta_id: string | null
          conta_tipo: string | null
          data: string | null
          data_efetiva: string | null
          data_pagamento: string | null
          descricao: string | null
          estrutura_grupo: string | null
          grupo: string | null
          id: string | null
          origem: string | null
          pacote: string | null
          plano_conta_id: string | null
          status: string | null
          subgrupo: string | null
          tenant_id: string | null
          tipo: string | null
          valor: number | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_lancamentos_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "finance_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_lancamentos_plano_conta_id_fkey"
            columns: ["plano_conta_id"]
            isOneToOne: false
            referencedRelation: "finance_plano_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_finance_transferencias_base: {
        Row: {
          ca_id: string | null
          ca_run_id: string | null
          conta_destino_banco: string | null
          conta_destino_id: string | null
          conta_destino_nome: string | null
          conta_destino_tipo: string | null
          conta_origem_banco: string | null
          conta_origem_id: string | null
          conta_origem_nome: string | null
          conta_origem_tipo: string | null
          data_transferencia: string | null
          descricao: string | null
          id: string | null
          origem: string | null
          status: string | null
          tenant_id: string | null
          valor: number | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_transferencias_conta_destino_id_fkey"
            columns: ["conta_destino_id"]
            isOneToOne: false
            referencedRelation: "finance_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transferencias_conta_origem_id_fkey"
            columns: ["conta_origem_id"]
            isOneToOne: false
            referencedRelation: "finance_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_vendas_kpi_base: {
        Row: {
          caixa_id: string | null
          caixa_nome: string | null
          cliente_id: string | null
          cliente_nome: string | null
          colaborador: string | null
          colaborador_id: string | null
          colaborador_nome: string | null
          convenio: string | null
          forma_pagamento: string | null
          grupo_de_produto: string | null
          id: number | null
          ingested_at: string | null
          is_base: boolean | null
          is_credito: boolean | null
          is_extra: boolean | null
          is_produto: boolean | null
          is_servico: boolean | null
          payload: Json | null
          produto: string | null
          servicos_ou_produtos: string | null
          source: string | null
          source_run_id: string | null
          telefone: string | null
          tipo_colaborador: string | null
          valor_bruto: number | null
          valor_faturamento: number | null
          valor_liquido: number | null
          venda_data_text: string | null
          venda_data_ts: string | null
          venda_dia: string | null
          venda_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_atualizar_dimensoes_periodo: {
        Args: { p_fim: string; p_inicio: string }
        Returns: {
          message: string
          ok: boolean
          periodo_fim: string
          periodo_inicio: string
        }[]
      }
      admin_truncate_vendas_api_raw_tmp: { Args: never; Returns: undefined }
      app_get_user_colaborador_id: { Args: never; Returns: string }
      app_is_master: { Args: never; Returns: boolean }
      app_is_own_profile: { Args: { check_user_id: string }; Returns: boolean }
      can_manage_users: { Args: { _user_id: string }; Returns: boolean }
      fn_assert_period: {
        Args: { p_fim: string; p_inicio: string }
        Returns: undefined
      }
      fn_bonus_simples: {
        Args: {
          p_colaborador_id: string
          p_comissao: number
          p_faturamento_extras: number
          p_faturamento_total: number
        }
        Returns: number
      }
      fn_caixas_upsert_from_raw_period: {
        Args: { p_fim: string; p_inicio: string }
        Returns: undefined
      }
      fn_comissao_pct: {
        Args: {
          p_ano: number
          p_colaborador_id: string
          p_faturamento: number
          p_mes: number
        }
        Returns: number
      }
      fn_current_user_context: {
        Args: never
        Returns: {
          colaborador_id: string
          org_id: string
          role_base: string
          unit_id: string
          user_id: string
        }[]
      }
      fn_dimensao_clientes_upsert_from_raw_period: {
        Args: { p_fim: string; p_inicio: string }
        Returns: undefined
      }
      fn_dimensao_colaboradores_upsert_from_raw_period: {
        Args: { p_fim: string; p_inicio: string }
        Returns: undefined
      }
      fn_dimensao_produtos_apply_classificacao: {
        Args: never
        Returns: undefined
      }
      fn_dimensao_produtos_upsert_from_raw_period: {
        Args: { p_fim: string; p_inicio: string }
        Returns: undefined
      }
      fn_norm_fone_br: { Args: { p_fone: string }; Returns: string }
      fn_norm_nome: { Args: { p_nome: string }; Returns: string }
      fn_period_stats: {
        Args: { p_fim: string; p_inicio: string }
        Returns: {
          clientes_unicos: number
          period_end: string
          period_start: string
          raw_rows: number
          valor_bruto: number
          valor_liquido: number
          vendas_unicas: number
        }[]
      }
      fn_raw_replace_period: {
        Args: { p_fim: string; p_inicio: string }
        Returns: Json
      }
      get_user_colaborador_id: { Args: { _user_id: string }; Returns: string }
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      get_user_role_base: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role_base"]
      }
      get_user_tenant_id: { Args: never; Returns: string }
      get_user_unit_id: { Args: { _user_id: string }; Returns: string }
      has_grant: {
        Args: {
          _grant_type: Database["public"]["Enums"]["app_grant_type"]
          _ref_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_master: { Args: { _user_id: string }; Returns: boolean }
      is_unidade_gerente: { Args: { _user_id: string }; Returns: boolean }
      rpc_analise_clientes_dinamica: {
        Args: {
          p_colaborador_id?: string
          p_dias_sem_vir?: number
          p_janela_primeira_visita?: number
          p_limit?: number
          p_max_atendimentos?: number
          p_min_atendimentos?: number
          p_ref_date?: string
        }
        Returns: {
          atendimentos_total: number
          cliente_id: string
          cliente_nome: string
          colaborador_nome_ultimo: string
          dias_sem_vir: number
          primeira_visita: string
          telefone: string
          ticket_medio: number
          ultima_visita: string
          valor_total: number
        }[]
      }
      rpc_clientes_barbearia_detalhe: {
        Args: { p_data_fim: string; p_data_inicio: string; p_ref_date?: string }
        Returns: Json
      }
      rpc_clientes_barbeiro_detalhe: {
        Args: {
          p_colaborador_id?: string
          p_data_fim: string
          p_data_inicio: string
          p_ref_date?: string
        }
        Returns: Json
      }
      rpc_clientes_carteira_compartilhada: {
        Args: { p_janelas?: number[]; p_ref?: string }
        Returns: Json
      }
      rpc_clientes_churn_barbeiros: {
        Args: {
          p_excluir_sem_cadastro?: boolean
          p_janela_dias?: number
          p_ref: string
        }
        Returns: {
          base_ativa: number
          churn_pct: number
          colaborador_id: string
          colaborador_nome: string
          compartilhados_pct: number
          exclusivos_pct: number
          perdidos: number
        }[]
      }
      rpc_clientes_churn_resumo: {
        Args: {
          p_excluir_sem_cadastro?: boolean
          p_janela_dias?: number
          p_ref: string
        }
        Returns: Json
      }
      rpc_clientes_churn_series: {
        Args: {
          p_excluir_sem_cadastro?: boolean
          p_fim: string
          p_inicio: string
          p_janela_dias?: number
        }
        Returns: {
          ano_mes: string
          base_ativa: number
          churn_pct: number
          perdidos: number
          resgatados: number
        }[]
      }
      rpc_clientes_cohort_barbeiros: {
        Args: {
          p_excluir_sem_cadastro?: boolean
          p_fim: string
          p_inicio: string
        }
        Returns: Json
      }
      rpc_clientes_cohort_geral: {
        Args: {
          p_excluir_sem_cadastro?: boolean
          p_fim: string
          p_inicio: string
        }
        Returns: {
          cohort_ano_mes: string
          m1_pct: number
          m2_pct: number
          m3_pct: number
          m6_pct: number
          size: number
        }[]
      }
      rpc_clientes_comparativo_barbeiros: {
        Args: { p_data_fim: string; p_data_inicio: string; p_ref_date?: string }
        Returns: Json
      }
      rpc_clientes_drill_faixa: {
        Args: {
          p_colaborador_id?: string
          p_data_fim?: string
          p_data_inicio?: string
          p_ref_date?: string
          p_tipo?: string
          p_valor?: string
        }
        Returns: Json
      }
      rpc_clientes_duplicados_dim: {
        Args: { p_limite?: number; p_similarity_min?: number }
        Returns: {
          cliente_id_a: string
          cliente_id_b: string
          cliente_nome_a: string
          cliente_nome_b: string
          motivo: string
          nascimento_a: string
          nascimento_b: string
          score: number
          sim_nome: number
          telefone_a: string
          telefone_b: string
        }[]
      }
      rpc_clientes_lista_carteira:
        | {
            Args: {
              p_colaborador_id: string
              p_export?: boolean
              p_janela_dias: number
              p_limit?: number
              p_modo?: string
              p_offset?: number
              p_ref: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_colaborador_id: string
              p_excluir_sem_cadastro?: boolean
              p_export?: boolean
              p_janela_dias: number
              p_limit?: number
              p_modo?: string
              p_offset?: number
              p_ref: string
            }
            Returns: Json
          }
      rpc_clientes_novos_drill_retencao: {
        Args: {
          p_data_fim: string
          p_data_inicio: string
          p_excluir_sem_cadastro?: boolean
          p_faixa?: string
          p_janela_conversao?: number
          p_ref_date?: string
        }
        Returns: Json
      }
      rpc_clientes_novos_lista: {
        Args: {
          p_barbeiro_aquisicao?: string
          p_data_fim: string
          p_data_inicio: string
          p_excluir_sem_cadastro?: boolean
          p_export?: boolean
          p_janela_conversao?: number
          p_limit?: number
          p_modo?: string
          p_offset?: number
          p_ref_date?: string
          p_status_novo?: string
        }
        Returns: Json
      }
      rpc_clientes_novos_resumo: {
        Args: {
          p_data_fim: string
          p_data_inicio: string
          p_excluir_sem_cadastro?: boolean
          p_janela_conversao?: number
          p_ref_date?: string
        }
        Returns: Json
      }
      rpc_clientes_painel_completo: {
        Args: {
          p_colaborador_id?: string
          p_data_fim?: string
          p_data_inicio?: string
          p_ref_date?: string
        }
        Returns: Json
      }
      rpc_clientes_saldo_base: {
        Args: {
          p_excluir_sem_cadastro?: boolean
          p_janela_dias?: number
          p_ref: string
        }
        Returns: Json
      }
      rpc_clientes_status_dinamico: {
        Args: {
          p_colaborador_id?: string
          p_janela_dias?: number
          p_ref_date?: string
          p_tipo_colaborador?: string
        }
        Returns: {
          atendimentos_periodo: number
          cadencia_bruta_dias: number
          cadencia_dias: number
          cadencia_metodo: string
          cliente_id: string
          cliente_nome: string
          colaborador_id_ultimo: string
          colaborador_nome_ultimo: string
          dias_sem_vir: number
          qtd_visitas_periodo: number
          ref_date: string
          status_cliente: string
          telefone: string
          ultima_visita_dia: string
          ultima_visita_ts: string
          valor_periodo: number
        }[]
      }
      rpc_clientes_unicos_evolucao:
        | { Args: { p_janelas?: number[]; p_ref?: string }; Returns: Json }
        | {
            Args: { p_janelas?: number[]; p_ref?: string; p_tipo?: string }
            Returns: Json
          }
      rpc_dashboard_daily: {
        Args: {
          p_colaborador_id?: string
          p_fim: string
          p_inicio: string
          p_tipo_colaborador?: string
        }
        Returns: Json
      }
      rpc_dashboard_kpis: {
        Args: {
          p_colaborador_id?: string
          p_fim: string
          p_inicio: string
          p_tipo_colaborador?: string
        }
        Returns: Json
      }
      rpc_dashboard_monthly: {
        Args: {
          p_ano_fim: number
          p_ano_inicio: number
          p_colaborador_id?: string
          p_mes_fim: number
          p_mes_inicio: number
          p_tipo_colaborador?: string
        }
        Returns: Json
      }
      rpc_dashboard_period: {
        Args: {
          p_colaborador_id?: string
          p_fim: string
          p_inicio: string
          p_tipo_colaborador?: string
        }
        Returns: Json
      }
      rpc_faturamento_comparacoes: {
        Args: {
          p_colaborador_id?: string
          p_fim: string
          p_forma_pagamento?: string
          p_grupo_de_produto?: string
          p_inicio: string
          p_produto?: string
          p_servicos_ou_produtos?: string
        }
        Returns: Json
      }
      rpc_faturamento_periodo: {
        Args: {
          p_colaborador_id?: string
          p_fim: string
          p_forma_pagamento?: string
          p_granularidade: string
          p_grupo_de_produto?: string
          p_inicio: string
          p_produto?: string
          p_servicos_ou_produtos?: string
        }
        Returns: Json
      }
      rpc_faturamento_por_colaborador: {
        Args: {
          p_fim: string
          p_forma_pagamento?: string
          p_grupo_de_produto?: string
          p_inicio: string
          p_produto?: string
          p_servicos_ou_produtos?: string
          p_tipo_colaborador?: string
        }
        Returns: Json
      }
      rpc_faturamento_por_dia_semana: {
        Args: {
          p_colaborador_id?: string
          p_fim: string
          p_grupo_de_produto?: string
          p_inicio: string
          p_servicos_ou_produtos?: string
        }
        Returns: Json
      }
      rpc_faturamento_por_faixa_horaria: {
        Args: {
          p_colaborador_id?: string
          p_fim: string
          p_grupo_de_produto?: string
          p_inicio: string
          p_servicos_ou_produtos?: string
        }
        Returns: Json
      }
      rpc_faturamento_por_grupo_de_produto: {
        Args: {
          p_colaborador_id?: string
          p_fim: string
          p_forma_pagamento?: string
          p_inicio: string
          p_servicos_ou_produtos?: string
        }
        Returns: Json
      }
      rpc_faturamento_por_item: {
        Args: {
          p_colaborador_id?: string
          p_fim: string
          p_forma_pagamento?: string
          p_grupo_de_produto?: string
          p_inicio: string
          p_limit?: number
          p_servicos_ou_produtos?: string
        }
        Returns: Json
      }
      rpc_faturamento_por_pagamento: {
        Args: {
          p_colaborador_id?: string
          p_fim: string
          p_grupo_de_produto?: string
          p_inicio: string
          p_servicos_ou_produtos?: string
        }
        Returns: Json
      }
      rpc_faturamento_resumo: {
        Args: {
          p_colaborador_id?: string
          p_fim: string
          p_forma_pagamento?: string
          p_grupo_de_produto?: string
          p_inicio: string
          p_produto?: string
          p_servicos_ou_produtos?: string
        }
        Returns: Json
      }
      rpc_finance_analise_rows: {
        Args: { p_fim: string; p_inicio: string; p_tenant_id: string }
        Returns: {
          categoria: string
          dre_linha: string
          mes: string
          pacote: string
          tipo: string
          valor: number
        }[]
      }
      rpc_finance_dashboard_period:
        | {
            Args: { p_fim: string; p_inicio: string; p_tenant_id: string }
            Returns: Json
          }
        | {
            Args: {
              p_fim: string
              p_inicio: string
              p_regime?: string
              p_tenant_id: string
            }
            Returns: Json
          }
      rpc_finance_despesas_pacotes: {
        Args: { p_fim: string; p_inicio: string; p_tenant_id: string }
        Returns: Json
      }
      rpc_finance_dre_period: {
        Args: { p_fim: string; p_inicio: string; p_tenant_id: string }
        Returns: {
          categoria: string
          dre_linha: string
          estrutura_grupo: string
          pacote: string
          total: number
        }[]
      }
      rpc_finance_lancamentos_totais: {
        Args: {
          p_fim: string
          p_inicio: string
          p_status?: string
          p_tenant_id: string
          p_tipo?: string
        }
        Returns: Json
      }
      rpc_finance_saldo_contas: {
        Args: {
          p_data_fim?: string
          p_data_inicio?: string
          p_tenant_id: string
        }
        Returns: {
          banco: string
          conta_id: string
          conta_nome: string
          conta_tipo: string
          despesas: number
          receitas: number
          saldo: number
          saldo_inicial: number
          transferencias_entrada: number
          transferencias_saida: number
        }[]
      }
      rpc_gerar_fila_mensagens: {
        Args: {
          p_colaborador_id?: string
          p_incluir_ativo_leve?: boolean
          p_janela_dias?: number
          p_limit?: number
          p_ref_date?: string
        }
        Returns: {
          gerados: number
          ignorados_por_duplicidade: number
          ref_date: string
        }[]
      }
      rpc_get_last_faturamento_date: { Args: never; Returns: string }
      rpc_listar_fila_mensagens: {
        Args: {
          p_categoria?: string
          p_colaborador_id?: string
          p_enviado?: boolean
          p_ref_date?: string
        }
        Returns: {
          categoria: string
          cliente_id: string
          cliente_nome: string
          colaborador_id: string
          colaborador_nome: string
          created_at: string
          enviado: boolean
          enviado_em: string
          enviado_por: string
          id: string
          mensagem_final: string
          observacao: string
          ref_date: string
          status_cliente: string
          telefone: string
          updated_at: string
        }[]
      }
      rpc_marcar_mensagem_enviada: {
        Args: {
          p_enviado_por: string
          p_id: string
          p_mensagem_final?: string
          p_observacao?: string
        }
        Returns: {
          enviado: boolean
          enviado_em: string
          enviado_por: string
          id: string
          mensagem_final: string
          observacao: string
          updated_at: string
        }[]
      }
      rpc_raiox_clientes_cadencia_drill_v1: {
        Args: {
          p_atribuicao_janela_meses?: number
          p_atribuicao_modo?: string
          p_base_corte_meses?: number
          p_base_mode?: string
          p_cadencia_meses_analise?: number
          p_cadencia_min_visitas?: number
          p_colaborador_id?: string
          p_excluir_sem_cadastro?: boolean
          p_fim: string
          p_inicio: string
          p_janela_dias?: number
          p_limit?: number
          p_one_shot_aguardando_max_dias?: number
          p_one_shot_risco_max_dias?: number
          p_ratio_espacando_max?: number
          p_ratio_muito_frequente_max?: number
          p_ratio_regular_max?: number
          p_ratio_risco_max?: number
          p_ref_mode?: string
          p_tipo?: string
          p_valor?: string
        }
        Returns: Json
      }
      rpc_raiox_clientes_cadencia_v1: {
        Args: {
          p_atribuicao_janela_meses?: number
          p_atribuicao_modo?: string
          p_base_corte_meses?: number
          p_base_mode?: string
          p_cadencia_meses_analise?: number
          p_cadencia_min_visitas?: number
          p_colaborador_id?: string
          p_excluir_sem_cadastro?: boolean
          p_fim: string
          p_inicio: string
          p_janela_dias?: number
          p_one_shot_aguardando_max_dias?: number
          p_one_shot_risco_max_dias?: number
          p_ratio_espacando_max?: number
          p_ratio_muito_frequente_max?: number
          p_ratio_regular_max?: number
          p_ratio_risco_max?: number
          p_ref_mode?: string
        }
        Returns: Json
      }
      rpc_raiox_clientes_cadencia_v2: {
        Args: {
          p_atribuicao_janela_meses?: number
          p_atribuicao_modo?: string
          p_base_corte_meses?: number
          p_base_mode?: string
          p_cadencia_meses_analise?: number
          p_cadencia_min_visitas?: number
          p_colaborador_id?: string
          p_excluir_sem_cadastro?: boolean
          p_fim: string
          p_grain?: string
          p_inicio: string
          p_janela_dias?: number
          p_one_shot_aguardando_max_dias?: number
          p_one_shot_risco_max_dias?: number
          p_range_months?: number
          p_ratio_espacando_max?: number
          p_ratio_muito_frequente_max?: number
          p_ratio_regular_max?: number
          p_ratio_risco_max?: number
          p_ref_mode?: string
        }
        Returns: Json
      }
      rpc_raiox_clientes_churn_drill_v1:
        | {
            Args: {
              p_atribuicao_janela_meses?: number
              p_atribuicao_modo?: string
              p_base_corte_meses?: number
              p_base_mode?: string
              p_cadencia_min_visitas?: number
              p_churn_dias_sem_voltar?: number
              p_colaborador_id?: string
              p_excluir_sem_cadastro?: boolean
              p_fim?: string
              p_inicio?: string
              p_janela_dias?: number
              p_limit?: number
              p_ref_mode?: string
              p_resgate_dias_minimos?: number
              p_risco_max_dias?: number
              p_risco_min_dias?: number
              p_tipo?: string
              p_valor?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_atribuicao_janela_meses?: number
              p_atribuicao_modo?: string
              p_base_corte_meses?: number
              p_base_mode?: string
              p_cadencia_min_visitas?: number
              p_churn_dias_sem_voltar?: number
              p_colaborador_id?: string
              p_excluir_sem_cadastro?: boolean
              p_fim?: string
              p_inicio?: string
              p_janela_dias?: number
              p_limit?: number
              p_ref_mode?: string
              p_risco_max_dias?: number
              p_risco_min_dias?: number
              p_tipo?: string
              p_valor?: string
            }
            Returns: Json
          }
      rpc_raiox_clientes_churn_evolucao_barbeiro_v1: {
        Args: {
          p_atribuicao_janela_meses?: number
          p_atribuicao_modo?: string
          p_base_corte_meses?: number
          p_base_mode?: string
          p_cadencia_min_visitas?: number
          p_churn_dias_sem_voltar?: number
          p_colaborador_id?: string
          p_excluir_sem_cadastro?: boolean
          p_fim: string
          p_inicio: string
          p_janela_dias?: number
          p_ref_mode?: string
          p_resgate_dias_minimos?: number
          p_risco_max_dias?: number
          p_risco_min_dias?: number
        }
        Returns: Json
      }
      rpc_raiox_clientes_churn_evolucao_v1: {
        Args: {
          p_atribuicao_janela_meses?: number
          p_atribuicao_modo?: string
          p_base_corte_meses?: number
          p_base_mode?: string
          p_cadencia_min_visitas?: number
          p_churn_dias_sem_voltar?: number
          p_colaborador_id?: string
          p_excluir_sem_cadastro?: boolean
          p_fim?: string
          p_inicio?: string
          p_janela_dias?: number
          p_ref_mode?: string
          p_resgate_dias_minimos?: number
          p_risco_max_dias?: number
          p_risco_min_dias?: number
        }
        Returns: Json
      }
      rpc_raiox_clientes_churn_evolucao_v2: {
        Args: {
          p_atribuicao_janela_meses?: number
          p_atribuicao_modo?: string
          p_base_corte_meses?: number
          p_base_mode?: string
          p_cadencia_min_visitas?: number
          p_churn_dias_sem_voltar?: number
          p_colaborador_id?: string
          p_excluir_sem_cadastro?: boolean
          p_fim: string
          p_inicio: string
          p_janela_dias?: number
          p_ref_mode?: string
          p_resgate_dias_minimos?: number
          p_risco_max_dias?: number
          p_risco_min_dias?: number
        }
        Returns: Json
      }
      rpc_raiox_clientes_churn_v1: {
        Args: {
          p_atribuicao_janela_meses?: number
          p_atribuicao_modo?: string
          p_base_corte_meses?: number
          p_base_mode?: string
          p_cadencia_min_visitas?: number
          p_churn_dias_sem_voltar?: number
          p_colaborador_id?: string
          p_excluir_sem_cadastro?: boolean
          p_fim?: string
          p_inicio?: string
          p_janela_dias?: number
          p_ref_mode?: string
          p_resgate_dias_minimos?: number
          p_risco_max_dias?: number
          p_risco_min_dias?: number
        }
        Returns: Json
      }
      rpc_raiox_clientes_overview_v1: {
        Args: {
          p_base_corte_meses?: number
          p_base_mode?: string
          p_cliente_key_mode?: string
          p_colaborador_id?: string
          p_excluir_sem_cadastro?: boolean
          p_fim?: string
          p_inicio?: string
          p_janela_dias?: number
          p_org_id?: string
          p_ref_mode?: string
          p_status12m_meses?: number
          p_unit_id?: string
        }
        Returns: Json
      }
      rpc_raiox_clientes_routing_v1: {
        Args: {
          p_base_corte_meses?: number
          p_colaborador_id?: string
          p_excluir_sem_cadastro?: boolean
          p_fim?: string
          p_focus_colaborador_id?: string
          p_inicio?: string
          p_janela_dias?: number
          p_limit?: number
        }
        Returns: Json
      }
      rpc_raiox_overview_drill_v1: {
        Args: {
          p_colaborador_id?: string
          p_excluir_sem_cadastro?: boolean
          p_fim?: string
          p_inicio?: string
          p_janela_dias?: number
          p_limit?: number
          p_tipo?: string
          p_valor?: string
        }
        Returns: Json
      }
      rpc_raiox_routing_barbeiro_evolucao_v1: {
        Args: { p_colaborador_id?: string; p_fim?: string; p_meses?: number }
        Returns: Json
      }
      rpc_raiox_visaogeral_drill_mensal_v1: {
        Args: {
          p_ano_mes: string
          p_colaborador_id?: string
          p_excluir_sem_cadastro?: boolean
          p_limit?: number
          p_offset?: number
          p_resgate_dias_minimos?: number
          p_risco_max_dias?: number
          p_risco_min_dias?: number
          p_tipo?: string
        }
        Returns: Json
      }
      rpc_rank_barbeiros_perda_clientes: {
        Args: {
          p_dias_sem_vir?: number
          p_janela_primeira_visita?: number
          p_limit?: number
          p_max_atendimentos?: number
          p_ref_date?: string
        }
        Returns: {
          clientes_sumiram: number
          colaborador_nome: string
          dias_medio_sem_vir: number
          novos_clientes: number
          taxa_perda: number
          ticket_medio_sumiram: number
          valor_sumiram: number
        }[]
      }
      rpc_servicos_analise: {
        Args: {
          p_agrupamento?: string
          p_colaborador_id?: string
          p_data_fim: string
          p_data_inicio: string
          p_tipo_servico?: string
        }
        Returns: Json
      }
      rpc_servicos_barbeiro_categoria: {
        Args: {
          p_colaborador_id?: string
          p_data_fim: string
          p_data_inicio: string
        }
        Returns: Json
      }
      rpc_snapshot_clientes_status: {
        Args: { p_janela_dias?: number; p_ref_date?: string }
        Returns: {
          inseridos_ou_atualizados: number
          snapshot_date: string
          total_clientes: number
        }[]
      }
      rpc_sync_contaazul_to_finance: {
        Args: {
          p_data_fim?: string
          p_data_inicio?: string
          p_tenant_id: string
        }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_grant_type:
        | "allow_org"
        | "allow_unit"
        | "allow_colaborador"
        | "allow_screen"
        | "allow_filter"
      app_permission_action:
        | "view"
        | "export"
        | "create"
        | "edit"
        | "delete"
        | "manage_users"
        | "grant_access"
        | "manage_rules"
        | "view_audit"
      app_role_base:
        | "master"
        | "franquia_admin"
        | "unidade_gerente"
        | "colaborador"
        | "org_admin"
        | "unit_manager"
        | "team_lead"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_grant_type: [
        "allow_org",
        "allow_unit",
        "allow_colaborador",
        "allow_screen",
        "allow_filter",
      ],
      app_permission_action: [
        "view",
        "export",
        "create",
        "edit",
        "delete",
        "manage_users",
        "grant_access",
        "manage_rules",
        "view_audit",
      ],
      app_role_base: [
        "master",
        "franquia_admin",
        "unidade_gerente",
        "colaborador",
        "org_admin",
        "unit_manager",
        "team_lead",
      ],
    },
  },
} as const
