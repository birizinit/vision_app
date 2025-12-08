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
        console.log("[v0] Trades da API para histórico:", data)

        // Converter trades da API para o formato de transações
        const apiTransactions: Transaction[] = data.data.map((trade: ApiTrade) => ({
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

        setTransactions(apiTransactions)
      } else {
        console.error("Erro ao buscar trades para histórico:", response.status)
      }
    } catch (error) {
      console.error("Erro na requisição de trades para histórico:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTrades()
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
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/30">Ganhou</Badge>
      case "LOSS":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/30">Perdeu</Badge>
      case "PENDING":
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">Pendente</Badge>
      case "CANCELLED":
        return <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/30">Cancelado</Badge>
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
      <Card className="bg-card/80 border-border/50">
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
                  <div className="w-10 h-10 bg-muted rounded-full"></div>
                  <div>
                    <div className="h-4 w-24 bg-muted rounded mb-2"></div>
                    <div className="h-3 w-32 bg-muted rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card/80 border-border/50">
      <CardContent className="p-6">
        <div className="space-y-4">
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhuma operação encontrada</p>
            </div>
          ) : (
            transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/40 transition-all duration-300 hover:scale-[1.02] border border-border/30"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted/40">
                    {getTypeIcon(transaction.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-foreground">{transaction.type}</span>
                      <span className="text-primary font-medium">{transaction.asset}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{transaction.date}</p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-3 mb-1">
                    <div>
                      <p className={`font-semibold ${getTypeColor(transaction.type)}`}>
                        ${transaction.amount.toFixed(2)}
                      </p>
                      <p className={`text-sm font-medium ${getResultColor(transaction.result)}`}>
                        {transaction.result > 0 ? "+" : ""}${transaction.result.toFixed(2)}
                      </p>
                    </div>
                    {getStatusBadge(transaction.status)}
                  </div>
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
