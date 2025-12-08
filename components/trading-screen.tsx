"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, TrendingUp, TrendingDown, Activity, Bot, Clock, DollarSign } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface Trade {
  id: string
  symbol: string
  amount: number
  direction: "BUY" | "SELL"
  result: "WON" | "LOST" | "PENDING" | "CANCELLED" | "COMPLETED"
  status: string
  pnl?: number
  openPrice?: number
  closePrice?: number
  createdAt: string
  isDemo: boolean
  payout?: number
  openTime?: number
  closeTime?: number
  expirationType?: string
  closeType?: string
}

interface Wallet {
  id: string
  name: string
  balance: number
  currency: string
  type: string
}

interface CandleData {
  time: string
  open: number
  high: number
  low: number
  close: number
  upperWick: number
  lowerWick: number
  body: number
  bodyBase: number
  isGreen: boolean
}

interface TradingScreenProps {
  onBack: () => void
  apiKey: string
}

export default function TradingScreen({ onBack, apiKey }: TradingScreenProps) {
  const [botActive, setBotActive] = useState<boolean>(false)
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true)
  const [botStats, setBotStats] = useState({
    totalTrades: 0,
    winRate: 0,
    profit: 0,
    lastTradeTime: null as Date | null,
  })
  const [trades, setTrades] = useState<Trade[]>([])
  const [pendingTrades, setPendingTrades] = useState<Trade[]>([])
  const [completedTrades, setCompletedTrades] = useState<Trade[]>([])
  const [btcPrice, setBtcPrice] = useState<number>(95000) // Preço inicial realístico
  const [priceChange, setPriceChange] = useState<number>(2.5) // Variação inicial
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [realBalance, setRealBalance] = useState<number>(0)
  const [demoBalance, setDemoBalance] = useState<number>(10000)
  const [candleHistory, setCandleHistory] = useState<CandleData[]>([])
  const [botStatus, setBotStatus] = useState<string>("Parado")

  const botIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastTradeTimeRef = useRef<number>(0)

  const fetchWallets = async () => {
    try {
      const timestamp = Date.now().toString()
      const response = await fetch("https://broker-api.mybroker.dev/token/wallets", {
        headers: {
          "api-token": apiKey,
          "x-timestamp": timestamp,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setWallets(data.data || [])
        const totalBalance = data.data?.reduce((sum: number, wallet: Wallet) => sum + wallet.balance, 0) || 0
        setRealBalance(totalBalance)
      }
    } catch (error) {
      console.error("Error fetching wallets:", error)
    }
  }

  useEffect(() => {
    fetchWallets()
  }, [apiKey])

  useEffect(() => {
    const simulateBTCPrice = () => {
      try {
        // Simula variação realística do Bitcoin
        const variation = (Math.random() - 0.5) * 500 // Variação de até $250 para cima ou para baixo
        const newPrice = Math.max(90000, Math.min(100000, btcPrice + variation)) // Mantém entre $90k-$100k

        // Calcula mudança percentual baseada na variação
        const percentChange = ((newPrice - btcPrice) / btcPrice) * 100

        setBtcPrice(newPrice)
        setPriceChange((prev) => {
          const newChange = prev + percentChange * 0.1 // Suaviza a mudança
          return Math.max(-10, Math.min(10, newChange)) // Limita entre -10% e +10%
        })

        const now = new Date()
        const timeString = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })

        setCandleHistory((prev) => {
          const open = prev.length > 0 ? prev[prev.length - 1].close : newPrice
          const close = newPrice
          const high = Math.max(open, close) + Math.random() * 200
          const low = Math.min(open, close) - Math.random() * 200

          const isGreen = close >= open
          const bodyHeight = Math.abs(close - open)
          const bodyBase = Math.min(open, close)
          const upperWick = high - Math.max(open, close)
          const lowerWick = Math.min(open, close) - low

          const newCandle: CandleData = {
            time: timeString,
            open,
            high,
            low,
            close,
            upperWick,
            lowerWick,
            body: bodyHeight,
            bodyBase,
            isGreen,
          }

          const newHistory = [...prev, newCandle]
          return newHistory.slice(-20)
        })
      } catch (error) {
        console.error("Error simulating BTC price:", error)
      }
    }

    // Inicializa com dados históricos simulados
    if (candleHistory.length === 0) {
      const initialCandles: CandleData[] = []
      let currentPrice = 95000

      for (let i = 0; i < 10; i++) {
        const variation = (Math.random() - 0.5) * 300
        const open = currentPrice
        const close = currentPrice + variation
        const high = Math.max(open, close) + Math.random() * 150
        const low = Math.min(open, close) - Math.random() * 150

        const isGreen = close >= open
        const bodyHeight = Math.abs(close - open)
        const bodyBase = Math.min(open, close)
        const upperWick = high - Math.max(open, close)
        const lowerWick = Math.min(open, close) - low

        const time = new Date(Date.now() - (10 - i) * 5000).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })

        initialCandles.push({
          time,
          open,
          high,
          low,
          close,
          upperWick,
          lowerWick,
          body: bodyHeight,
          bodyBase,
          isGreen,
        })

        currentPrice = close
      }

      setCandleHistory(initialCandles)
      setBtcPrice(currentPrice)
    }

    simulateBTCPrice()
    const interval = setInterval(simulateBTCPrice, 5000)
    return () => clearInterval(interval)
  }, [btcPrice])

  useEffect(() => {
    fetchTrades()
  }, [])

  useEffect(() => {
    if (botActive) {
      setBotStatus("Analisando mercado...")
      botIntervalRef.current = setInterval(() => {
        analyzeBotEntry()
      }, 10000) // Verifica a cada 10 segundos
    } else {
      setBotStatus("Parado")
      if (botIntervalRef.current) {
        clearInterval(botIntervalRef.current)
        botIntervalRef.current = null
      }
    }

    return () => {
      if (botIntervalRef.current) {
        clearInterval(botIntervalRef.current)
      }
    }
  }, [botActive, candleHistory])

  const fetchTrades = async () => {
    try {
      const timestamp = Date.now().toString()
      console.log("[v0] Fetching trades with API key:", apiKey.substring(0, 10) + "...")

      const response = await fetch("https://broker-api.mybroker.dev/token/trades?page=1&pageSize=20", {
        headers: {
          "api-token": apiKey,
          "x-timestamp": timestamp,
        },
      })

      console.log("[v0] Trades response status:", response.status)

      if (response.ok) {
        const data = await response.json()
        console.log("[v0] Trades data received:", data)

        const allTrades = data.data || []
        setTrades(allTrades)

        const pending = allTrades.filter((trade: Trade) => trade.result === "PENDING")
        const completed = allTrades.filter((trade: Trade) => trade.result !== "PENDING")

        setPendingTrades(pending)
        setCompletedTrades(completed)

        const wonTrades = completed.filter((trade: Trade) => trade.result === "WON").length
        const totalCompleted = completed.length
        const winRate = totalCompleted > 0 ? (wonTrades / totalCompleted) * 100 : 0
        const totalProfit = completed.reduce((sum: number, trade: Trade) => sum + (trade.pnl || 0), 0)

        setBotStats({
          totalTrades: totalCompleted,
          winRate,
          profit: totalProfit,
          lastTradeTime: completed.length > 0 ? new Date(completed[0].createdAt) : null,
        })
      } else {
        const errorText = await response.text()
        console.error("[v0] Error fetching trades:", errorText)
      }
    } catch (error) {
      console.error("[v0] Error fetching trades:", error)
    }
  }

  const analyzeBotEntry = async () => {
    const now = Date.now()

    if (now - lastTradeTimeRef.current < 60000) {
      setBotStatus("Aguardando próxima janela...")
      return
    }

    const currentBalance = isDemoMode ? demoBalance : realBalance
    if (currentBalance < 1) {
      setBotStatus("Saldo insuficiente")
      setBotActive(false)
      return
    }

    if (candleHistory.length < 3) {
      setBotStatus("Coletando dados...")
      return
    }

    setBotStatus("Analisando entrada...")

    const lastCandles = candleHistory.slice(-3)
    const currentCandle = lastCandles[lastCandles.length - 1]
    const previousCandle = lastCandles[lastCandles.length - 2]

    let direction: "BUY" | "SELL"

    if (currentCandle.close > previousCandle.close && previousCandle.close > lastCandles[0].close) {
      direction = "BUY"
    } else if (currentCandle.close < previousCandle.close && previousCandle.close < lastCandles[0].close) {
      direction = "SELL"
    } else {
      direction = Math.random() > 0.5 ? "BUY" : "SELL"
    }

    setBotStatus(`Abrindo ${direction}...`)
    await openBotTrade(direction)
  }

  const openBotTrade = async (direction: "BUY" | "SELL") => {
    try {
      const timestamp = Date.now().toString()

      const requestBody = {
        isDemo: isDemoMode,
        amount: 1,
        closeType: "00:05", // 5 minutos - menor tempo válido disponível
        expirationType: "CANDLE_CLOSE",
        symbol: "BTCUSDT",
        direction,
      }

      console.log("[v0] Opening bot trade:", requestBody)
      console.log("[v0] Using API key:", apiKey.substring(0, 10) + "...")
      console.log("[v0] Timestamp:", timestamp)

      const response = await fetch("https://broker-api.mybroker.dev/token/trades/open", {
        method: "POST",
        headers: {
          "api-token": apiKey,
          "x-timestamp": timestamp,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      console.log("[v0] Bot trade response status:", response.status)

      if (response.ok) {
        const data = await response.json()
        console.log("[v0] Bot trade success:", data)

        setBotStatus(`${direction} aberto - ID: ${data.id}`)
        lastTradeTimeRef.current = Date.now()

        setTimeout(() => {
          fetchTrades()
          fetchWallets()
        }, 2000)
      } else {
        const errorText = await response.text()
        console.error("[v0] Bot trade error response:", errorText)
        setBotStatus(`Erro: HTTP ${response.status}`)
      }
    } catch (error) {
      setBotStatus("Erro de conexão")
      console.error("[v0] Bot trade error:", error)
    }
  }

  const getResultColor = (result: string) => {
    switch (result) {
      case "WON":
        return "bg-green-500/20 text-green-400 border-green-500/30"
      case "LOST":
        return "bg-red-500/20 text-red-400 border-red-500/30"
      case "PENDING":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
      case "CANCELLED":
        return "bg-gray-500/20 text-gray-400 border-gray-500/30"
      default:
        return "bg-blue-500/20 text-blue-400 border-blue-500/30"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("pt-BR")
  }

  const formatCloseType = (closeType: string) => {
    if (!closeType) return "N/A"
    const [hours, minutes] = closeType.split(":")
    if (hours === "00") {
      return `${minutes}min`
    }
    return `${hours}h${minutes}min`
  }

  const CandlestickBar = (props: any) => {
    const { payload, x, y, width, height } = props
    if (!payload) return null

    const { isGreen, bodyBase, body, upperWick, lowerWick, high, low } = payload

    const candleWidth = Math.max(width * 0.6, 2)
    const wickWidth = 1
    const centerX = x + width / 2

    return (
      <g>
        <line
          x1={centerX}
          y1={y + height - (high - low > 0 ? (upperWick / (high - low)) * height : 0)}
          x2={centerX}
          y2={y + height - (high - low > 0 ? ((upperWick + body) / (high - low)) * height : 0)}
          stroke={isGreen ? "#10B981" : "#EF4444"}
          strokeWidth={wickWidth}
        />

        <rect
          x={centerX - candleWidth / 2}
          y={y + height - (high - low > 0 ? ((body + (bodyBase - low)) / (high - low)) * height : 0)}
          width={candleWidth}
          height={high - low > 0 ? (body / (high - low)) * height : 0}
          fill={isGreen ? "#10B981" : "#EF4444"}
          stroke={isGreen ? "#10B981" : "#EF4444"}
        />

        <line
          x1={centerX}
          y1={y + height - (high - low > 0 ? (lowerWick / (high - low)) * height : 0)}
          x2={centerX}
          y2={y + height - (high - low > 0 ? ((lowerWick + (bodyBase - low)) / (high - low)) * height : 0)}
          stroke={isGreen ? "#10B981" : "#EF4444"}
          strokeWidth={wickWidth}
        />
      </g>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white">
      <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-gold-500/20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={onBack} className="text-gold-400 hover:text-gold-300 hover:bg-gold-500/10">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Dashboard
            </Button>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 p-2 bg-gray-800/50 rounded-lg border border-gray-700/50">
                <span className={`text-sm ${!isDemoMode ? "text-gray-400" : "text-gold-400 font-medium"}`}>Demo</span>
                <Switch
                  checked={!isDemoMode}
                  onCheckedChange={(checked) => setIsDemoMode(!checked)}
                  className="data-[state=checked]:bg-gold-500"
                />
                <span className={`text-sm ${isDemoMode ? "text-gray-400" : "text-gold-400 font-medium"}`}>Real</span>
              </div>

              <div className="text-right">
                <p className="text-sm text-gray-400">Saldo {isDemoMode ? "Demo" : "Real"}</p>
                <p className="text-xl font-bold text-gold-400">
                  ${(isDemoMode ? demoBalance : realBalance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-gradient-to-r from-gray-900/50 to-black/50 border-gold-500/20 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gold-400">
                  <Activity className="w-5 h-5" />
                  BTCUSDT
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-3xl font-bold text-white">
                      ${btcPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                    <p
                      className={`text-sm flex items-center gap-1 ${priceChange >= 0 ? "text-green-400" : "text-red-400"}`}
                    >
                      {priceChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {priceChange.toFixed(2)}% (24h)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Atualização a cada 5s</p>
                    <p className="text-sm text-gold-400">{new Date().toLocaleTimeString("pt-BR")}</p>
                  </div>
                </div>

                {candleHistory.length > 1 && (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={candleHistory} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} interval="preserveStartEnd" />
                        <YAxis stroke="#9CA3AF" fontSize={12} domain={["dataMin - 50", "dataMax + 50"]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1F2937",
                            border: "1px solid #D97706",
                            borderRadius: "8px",
                            color: "#F3F4F6",
                          }}
                          formatter={(value: number, name: string) => {
                            if (name === "high") return [`$${value.toLocaleString()}`, "Máxima"]
                            if (name === "low") return [`$${value.toLocaleString()}`, "Mínima"]
                            if (name === "open") return [`$${value.toLocaleString()}`, "Abertura"]
                            if (name === "close") return [`$${value.toLocaleString()}`, "Fechamento"]
                            return [`$${value.toLocaleString()}`, name]
                          }}
                          labelFormatter={(label) => `Horário: ${label}`}
                        />
                        <Bar dataKey="high" shape={CandlestickBar} fill="transparent" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-gray-900/50 to-black/50 border-gold-500/20 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gold-400">
                  <Bot className="w-5 h-5" />
                  Bot de Trading Automático
                  <Badge className={isDemoMode ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400"}>
                    {isDemoMode ? "DEMO" : "REAL"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${botActive ? "bg-green-400 animate-pulse" : "bg-red-400"}`}
                    />
                    <div>
                      <p className="text-white font-medium">Status do Bot</p>
                      <p className="text-sm text-gray-400">{botStatus}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-400">{botActive ? "Ativo" : "Inativo"}</span>
                    <Switch
                      checked={botActive}
                      onCheckedChange={setBotActive}
                      className="data-[state=checked]:bg-gold-500"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50 text-center">
                    <DollarSign className="w-6 h-6 text-gold-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Valor por Trade</p>
                    <p className="text-lg font-bold text-white">$1.00</p>
                  </div>
                  <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50 text-center">
                    <Clock className="w-6 h-6 text-gold-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Expiração</p>
                    <p className="text-lg font-bold text-white">5 min</p>
                  </div>
                  <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50 text-center">
                    <Activity className="w-6 h-6 text-gold-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Modo</p>
                    <p className="text-lg font-bold text-white">{isDemoMode ? "Demo" : "Real"}</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{botStats.totalTrades}</p>
                    <p className="text-sm text-gray-400">Total de Trades</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${botStats.winRate >= 50 ? "text-green-400" : "text-red-400"}`}>
                      {botStats.winRate.toFixed(1)}%
                    </p>
                    <p className="text-sm text-gray-400">Taxa de Acerto</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${botStats.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                      ${botStats.profit.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-400">Lucro Total</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{pendingTrades.length}</p>
                    <p className="text-sm text-gray-400">Pendentes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-gradient-to-r from-gray-900/50 to-black/50 border-gold-500/20 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-gold-400 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Operações Pendentes ({pendingTrades.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {pendingTrades.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">Nenhuma operação pendente</p>
                  ) : (
                    pendingTrades.map((trade) => (
                      <div
                        key={trade.id}
                        className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30 hover:border-yellow-400/50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">PENDENTE</Badge>
                            <Badge
                              className={
                                trade.isDemo ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400"
                              }
                            >
                              {trade.isDemo ? "DEMO" : "REAL"}
                            </Badge>
                          </div>
                          <span
                            className={`text-sm font-medium ${
                              trade.direction === "BUY" ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {trade.direction}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-300">{trade.symbol}</span>
                          <span className="text-white font-medium">${trade.amount}</span>
                        </div>

                        {trade.closeType && (
                          <div className="flex justify-between items-center text-sm mt-1">
                            <span className="text-gray-400">Expiração:</span>
                            <span className="text-gold-400">{formatCloseType(trade.closeType)}</span>
                          </div>
                        )}

                        <p className="text-xs text-gray-500 mt-2">{formatDate(trade.createdAt)}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-gray-900/50 to-black/50 border-gold-500/20 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-gold-400 flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Operações Finalizadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {completedTrades.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">Nenhuma operação finalizada</p>
                  ) : (
                    completedTrades.slice(0, 15).map((trade) => (
                      <div
                        key={trade.id}
                        className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/50 hover:border-gold-500/30 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge className={getResultColor(trade.result)}>{trade.result}</Badge>
                            <Badge
                              className={
                                trade.isDemo ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400"
                              }
                            >
                              {trade.isDemo ? "DEMO" : "REAL"}
                            </Badge>
                          </div>
                          <span
                            className={`text-sm font-medium ${
                              trade.direction === "BUY" ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {trade.direction}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-300">{trade.symbol}</span>
                          <span className="text-white font-medium">${trade.amount}</span>
                        </div>

                        {trade.openPrice && (
                          <div className="flex justify-between items-center text-sm mt-1">
                            <span className="text-gray-400">Abertura:</span>
                            <span className="text-white">${trade.openPrice.toLocaleString()}</span>
                          </div>
                        )}

                        {trade.closePrice && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-400">Fechamento:</span>
                            <span className="text-white">${trade.closePrice.toLocaleString()}</span>
                          </div>
                        )}

                        {trade.pnl !== undefined && (
                          <div className="flex justify-between items-center text-sm mt-1">
                            <span className="text-gray-400">P&L:</span>
                            <span className={`font-medium ${trade.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                              ${trade.pnl.toFixed(2)}
                            </span>
                          </div>
                        )}

                        {trade.payout && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-400">Payout:</span>
                            <span className="text-gold-400">{trade.payout}%</span>
                          </div>
                        )}

                        <p className="text-xs text-gray-500 mt-2">{formatDate(trade.createdAt)}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
