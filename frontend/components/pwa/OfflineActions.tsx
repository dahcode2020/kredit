"use client";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function RetryButton({ label = "Réessayer" }: { label?: string }) {
  return <Button onClick={() => window.location.reload()} className="gap-2"><RefreshCw className="w-4 h-4"/> {label}</Button>;
}
