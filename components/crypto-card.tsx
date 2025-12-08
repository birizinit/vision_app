"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUpIcon, TrendingDownIcon } from "lucide-react"
import Image from "next/image"

interface CryptoData {
  id: string
  symbol: string
  name: string
  current_price: number
  price_change_percentage_24h: number
  image: string
}

interface CryptoCardProps {
  crypto: CryptoData
}

export function CryptoCard({ crypto }: CryptoCardProps) {
  const isPositive = crypto.price_change_percentage_24h > 0
  const changeColor = isPositive ? "text-green-500" : "text-red-500"
  const bgColor = isPositive ? "bg-green-500/10" : "bg-red-500/10"

  return (
    <Card className="bg-card/80 border-border/50 hover:border-primary/30 transition-all duration-300 hover:scale-105 group overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative h-8 w-8 rounded-full overflow-hidden">
              <Image src={crypto.image || "/placeholder.svg"} alt={crypto.name} fill className="object-cover" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{crypto.symbol.toUpperCase()}</p>
              <p className="text-sm text-muted-foreground">{crypto.symbol.toUpperCase()}/USD</p>
            </div>
          </div>
          <Badge variant="outline" className={`${bgColor} ${changeColor} border-current`}>
            {isPositive ? <TrendingUpIcon className="h-3 w-3 mr-1" /> : <TrendingDownIcon className="h-3 w-3 mr-1" />}
            {Math.abs(crypto.price_change_percentage_24h).toFixed(2)}%
          </Badge>
        </div>

        <div className="space-y-2">
          <p className="text-2xl font-bold text-primary">
            $
            {crypto.current_price.toLocaleString("en-US", {
              minimumFractionDigits: crypto.current_price < 1 ? 4 : 2,
              maximumFractionDigits: crypto.current_price < 1 ? 4 : 2,
            })}
          </p>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${changeColor}`}>
              {isPositive ? "+" : ""}
              {crypto.price_change_percentage_24h.toFixed(2)}% 24h
            </span>
          </div>
        </div>

        {/* Subtle animation overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
      </CardContent>
    </Card>
  )
}
