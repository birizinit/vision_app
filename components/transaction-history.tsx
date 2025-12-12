"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowUpIcon, ArrowDownIcon } from "lucide-react"

interface ApiTrade {
  id: string
  symbol: string
  direction: "BUY" | "SELL"
  amount: number
  result: string
  status: string
  pnl?: number
  createdAt: string
  updatedAt: string
  openPrice?: number
  closePrice?: number
}

interface Transaction {
  id: string
  type: "BUY" | "SELL"
  asset: string
  amount: number
  result: number
  date: string
  status: "WIN" | "LOSS" | "PENDING" | "CANCELLED"
  openPrice?: number
  closePrice?: number
}

interface TransactionHistoryProps {
  apiKey?: string
}

export function TransactionHistory({ apiKey }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTrades = async () => {
    if (!apiKey) {
      setLoading(false)
      return
    }

    try {
      const timestamp = Date.now().toString()
      const response = await fetch("https://broker-api.mybroker.dev/token/trades?page=1&pageSize=20", {
        method: "GET",
        headers: {
          "api-token": apiKey,
          "x-timestamp": timestamp,
        },
      })

      if (response.ok) {
        const data = await response.json()
        console.log("[TransactionHistory] Resposta completa da API:", data)

        // Verificar a estrutura da resposta - pode ser data.data ou data diretamente
        let rawTrades: ApiTrade[] = []
        
        if (Array.isArray(data)) {
          // Se a resposta é um array direto
          rawTrades = data
        } else if (data?.data && Array.isArray(data.data)) {
          // Se a resposta tem uma propriedade data que é um array
          rawTrades = data.data
        } else if (data?.trades && Array.isArray(data.trades)) {
          // Se a resposta tem uma propriedade trades
          rawTrades = data.trades
        } else {
          console.warn("[TransactionHistory] Estrutura de resposta inesperada:", data)
          rawTrades = []
        }

        console.log("[TransactionHistory] Trades processados:", rawTrades.length, rawTrades)

        // Converter trades da API para o formato de transações
        const apiTransactions: Transaction[] = rawTrades.map((trade: ApiTrade) => ({
          id: trade.id,
          type: trade.direction,
          asset: trade.symbol,
          amount: trade.amount,
          result: trade.pnl || 0,
          date: new Date(trade.createdAt).toLocaleString("pt-BR"),
          status:
            trade.result === "WON"
              ? "WIN"
              : trade.result === "LOST"
                ? "LOSS"
                : trade.status === "CANCELLED"
                  ? "CANCELLED"
                  : "PENDING",
          openPrice: trade.openPrice,
          closePrice: trade.closePrice,
        }))

        console.log("[TransactionHistory] Transações convertidas:", apiTransactions.length, apiTransactions)
        setTransactions(apiTransactions)
      } else {
        const errorText = await response.text()
        console.error("Erro ao buscar trades para histórico:", response.status, errorText)
        setTransactions([])
      }
    } catch (error) {
      console.error("Erro na requisição de trades para histórico:", error)
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!apiKey) {
      setLoading(false)
      return
    }

    fetchTrades()
    
    // Atualizar automaticamente a cada 30 segundos
    const interval = setInterval(() => {
      fetchTrades()
    }, 30000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey])

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "BUY":
        return <ArrowUpIcon className="h-4 w-4 text-green-500" />
      case "SELL":
        return <ArrowDownIcon className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "BUY":
        return "text-green-500"
      case "SELL":
        return "text-red-500"
      default:
        return "text-foreground"
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "WIN":
        return <Badge className="bg-green-500 text-white border-0 rounded-[5px] px-3 py-1">GANHOU</Badge>
      case "LOSS":
        return <Badge className="bg-red-500 text-white border-0 rounded-[5px] px-3 py-1">PERDEU</Badge>
      case "PENDING":
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30 rounded-[5px] px-3 py-1">Pendente</Badge>
      case "CANCELLED":
        return <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/30 rounded-[5px] px-3 py-1">Cancelado</Badge>
      default:
        return null
    }
  }

  const getResultColor = (result: number) => {
    if (result > 0) return "text-green-500"
    if (result < 0) return "text-red-500"
    return "text-muted-foreground"
  }

  if (loading) {
    return (
      <Card className="border-border/50" style={{ backgroundColor: '#020b1a' }}>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="grid grid-cols-3 gap-4 py-3">
                  <div className="h-4 bg-muted rounded"></div>
                  <div className="h-4 bg-muted rounded"></div>
                  <div className="h-4 bg-muted rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/50" style={{ backgroundColor: '#020b1a' }}>
      <CardContent className="p-6">
        {/* Título dentro do container */}
        <h2 className="text-2xl font-bold text-white mb-4">Últimas Operações</h2>
        
        {/* Linha divisória após o título */}
        <div className="border-b border-border/50 mb-4"></div>

        {/* Header da Tabela - apenas as 2 últimas colunas */}
        <div className="grid grid-cols-3 gap-4 pb-3 border-b border-border/50 mb-4">
          <div></div>
          <div className="text-sm font-semibold text-white uppercase">Valor Entrada</div>
          <div className="text-sm font-semibold text-white uppercase">Resultado</div>
        </div>

        {/* Corpo da Tabela */}
        <div className="space-y-3">
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">Nenhuma operação encontrada</p>
              <p className="text-xs text-muted-foreground/70">
                Seus dados reais da API serão exibidos aqui quando houver operações
              </p>
            </div>
          ) : (
            transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="grid grid-cols-3 gap-4 py-3 hover:bg-muted/20 transition-colors duration-200 rounded-lg px-2"
              >
                {/* Coluna Operação - com ícone em quadrado arredondado */}
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-[5px] ${
                    transaction.type === "BUY" 
                      ? "bg-green-600/30" 
                      : "bg-red-600/30"
                  }`}>
                    {transaction.type === "BUY" ? (
                      <ArrowUpIcon className="h-4 w-4 text-green-400" />
                    ) : (
                      <ArrowDownIcon className="h-4 w-4 text-red-400" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white font-medium">
                      {transaction.type} {transaction.asset}
                    </span>
                    <span className="text-xs text-muted-foreground">{transaction.date}</span>
                  </div>
                </div>

                {/* Coluna Valor de Entrada - apenas o valor */}
                <div className="flex items-center">
                  <span className="text-white font-medium">${transaction.amount.toFixed(2)}</span>
                </div>

                {/* Coluna Resultado - valor colorido + badge */}
                <div className="flex items-center gap-3">
                  <span className={`font-medium ${getResultColor(transaction.result)}`}>
                    {transaction.result > 0 ? "+" : ""}${transaction.result.toFixed(2)}
                  </span>
                  {transaction.status === "WIN" || transaction.status === "LOSS" ? (
                    getStatusBadge(transaction.status)
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        {transactions.length > 0 && (
          <div className="mt-6 text-center">
            <button
              className="text-primary hover:text-primary/80 font-medium transition-colors duration-300"
              onClick={fetchTrades}
            >
              Atualizar Operações →
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
