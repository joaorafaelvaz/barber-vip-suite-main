 /**
  * Dialog para editar uma regra de comissão existente
  */
 
 import { useState, useEffect } from 'react';
 import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Switch } from '@/components/ui/switch';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Loader2 } from 'lucide-react';
 import FaixasEditor from './FaixasEditor';
 import { useSalvarConfiguracaoMes } from '@/hooks/useRegrasComissao';
 import { HistoricoRegraItem, FAIXAS_PADRAO } from '@/types/comissao';
 
 const MESES = [
   'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
 ];
 
 interface EditarRegraDialogProps {
   regra: HistoricoRegraItem | null;
   onClose: () => void;
 }
 
 export default function EditarRegraDialog({ regra, onClose }: EditarRegraDialogProps) {
   const [usaEscalonamento, setUsaEscalonamento] = useState(true);
   const [percentualFixo, setPercentualFixo] = useState<number>(35);
   const [faixas, setFaixas] = useState(FAIXAS_PADRAO);
   
   const salvarMutation = useSalvarConfiguracaoMes();
 
   useEffect(() => {
     if (regra) {
       setUsaEscalonamento(regra.regra.usa_escalonamento);
       setPercentualFixo(regra.regra.percentual_fixo || 35);
       if (regra.faixas.length > 0) {
         setFaixas(regra.faixas.map(f => ({
           faixa_ordem: f.faixa_ordem,
           nome: f.nome,
           valor_minimo: f.valor_minimo,
           valor_maximo: f.valor_maximo,
           percentual: f.percentual,
           cor: f.cor,
         })));
       }
     }
   }, [regra]);
 
   const handleSalvar = async () => {
     if (!regra) return;
 
     const tipoConfig = {
       usa_escalonamento: usaEscalonamento,
       percentual_fixo: usaEscalonamento ? null : percentualFixo,
       faixas: usaEscalonamento ? faixas : [],
     };
 
     // Determinar se é serviço ou produto
     const config = regra.regra.tipo === 'SERVICO' 
       ? { servicos: tipoConfig, produtos: { usa_escalonamento: false, percentual_fixo: 0, faixas: [] } }
       : { servicos: { usa_escalonamento: false, percentual_fixo: 0, faixas: [] }, produtos: tipoConfig };
 
     await salvarMutation.mutateAsync({
       ano: regra.regra.ano,
       mes: regra.regra.mes,
       colaboradorId: regra.regra.colaborador_id,
       config,
     });
 
     onClose();
   };
 
   if (!regra) return null;
 
   return (
     <Dialog open={!!regra} onOpenChange={() => onClose()}>
       <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
         <DialogHeader>
           <DialogTitle>
             Editar {regra.regra.tipo === 'SERVICO' ? 'Serviços' : 'Produtos'} - {MESES[regra.regra.mes - 1]} {regra.regra.ano}
             {regra.colaborador_nome && ` (${regra.colaborador_nome})`}
           </DialogTitle>
         </DialogHeader>
 
         <div className="space-y-4 py-4">
           <Card>
             <CardHeader className="py-3">
               <CardTitle className="text-sm font-medium">
                 Tipo de Comissão
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="flex items-center justify-between">
                 <Label>Usar escalonamento por faixas</Label>
                 <Switch
                   checked={usaEscalonamento}
                   onCheckedChange={setUsaEscalonamento}
                 />
               </div>
 
               {!usaEscalonamento && (
                 <div>
                   <Label>Percentual fixo (%)</Label>
                   <Input
                     type="number"
                     value={percentualFixo}
                     onChange={(e) => setPercentualFixo(Number(e.target.value))}
                     className="mt-1"
                     min={0}
                     max={100}
                   />
                 </div>
               )}
 
               {usaEscalonamento && (
                 <div>
                   <Label className="mb-2 block">Faixas de Comissão</Label>
                   <FaixasEditor faixas={faixas} onChange={setFaixas} />
                 </div>
               )}
             </CardContent>
           </Card>
 
           <div className="flex justify-end gap-2">
             <Button variant="outline" onClick={onClose}>
               Cancelar
             </Button>
             <Button onClick={handleSalvar} disabled={salvarMutation.isPending}>
               {salvarMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
               Salvar
             </Button>
           </div>
         </div>
       </DialogContent>
     </Dialog>
   );
 }