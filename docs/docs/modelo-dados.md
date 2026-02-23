# Modelo de Dados (para o app)

## militar
- id
- posto (SGT, SUBTEN)
- matricula
- nome
- ala (ALA I, II, III, IV)
- status (ATIVO, LICENÇA, MOVIMENTADO)
- licenca_inicio (opcional)
- licenca_fim (opcional)

## servico
- id
- data
- ala
- tipo (RAS)
- precisa_sobreaviso (SIM/NÃO)
- vagas_abertas (calculado)
- observacao

## escolha
- id
- militar_id
- servico_id
- status (PENDENTE, APROVADO, NEGADO) ou (QUERO, NAO_QUERO, INDISPONIVEL)
- data_hora
- observacao

## sobreaviso_rodizio
- ala
- militar_a
- militar_b
- ultimo_usado (A ou B)
- regra_substituicao (se A ou B indisponível)

## sobreaviso_designacao
- data
- ala (ou geral)
- militar_designado
- tipo (NORMAL, COBERTURA)
- motivo (LICENÇA, MOVIMENTAÇÃO, VAGA, OUTRO)
- militar_original (se cobertura)
