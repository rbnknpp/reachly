import * as React from "react";
import { AlertTriangle, Bot, User, Send } from "lucide-react";
import { toast } from "sonner";
import {
  useConversations,
  useMessages,
  useSendManualReply,
  useUpdateConversationStatus,
} from "@/hooks/useConversations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatDateTime, formatTime, hoursSince } from "@/lib/utils";
import type { ConversationStatus, ConversationWithCustomer } from "@schema/database";

const STATUS_LABEL: Record<ConversationStatus, string> = {
  ai_active: "KI aktiv",
  human_handoff: "Übernommen",
  closed: "Geschlossen",
};

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  sms: "SMS",
  email: "E-Mail",
};

function ConversationBadge({ status }: { status: ConversationStatus }) {
  if (status === "ai_active") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Bot className="h-3 w-3" /> KI
      </Badge>
    );
  }
  if (status === "human_handoff") {
    return (
      <Badge variant="success" className="gap-1">
        <User className="h-3 w-3" /> Mensch
      </Badge>
    );
  }
  return <Badge variant="outline">Geschlossen</Badge>;
}

export function Inbox({ clientId }: { clientId: string | undefined }) {
  const { data: conversations, isLoading } = useConversations(clientId);
  const [filter, setFilter] = React.useState<"all" | ConversationStatus>("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const filtered = React.useMemo(
    () => (conversations ?? []).filter((c) => filter === "all" || c.status === filter),
    [conversations, filter],
  );

  const selected = filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? null;

  React.useEffect(() => {
    if (!selectedId && filtered.length > 0) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  return (
    <div className="grid h-[calc(100vh-6rem)] grid-cols-1 overflow-hidden rounded-lg border border-border md:grid-cols-[320px_1fr]">
      <div className={cn("flex flex-col border-border md:border-r", selected && "hidden md:flex")}>
        <div className="flex items-center gap-1 border-b border-border p-2">
          {(["all", "ai_active", "human_handoff", "closed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium",
                filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {f === "all" ? "Alle" : STATUS_LABEL[f]}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading && <div className="p-4 text-sm text-muted-foreground">Lädt …</div>}
          {!isLoading && filtered.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">Keine Konversationen.</div>
          )}
          {filtered.map((c) => (
            <ConversationListItem key={c.id} conversation={c} active={c.id === selected?.id} onClick={() => setSelectedId(c.id)} />
          ))}
        </div>
      </div>

      <div className={cn("flex min-w-0 flex-col", !selected && "hidden md:flex")}>
        {selected ? (
          <ChatPanel key={selected.id} conversation={selected} clientId={clientId} onBack={() => setSelectedId(null)} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Konversation auswählen
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationListItem({
  conversation,
  active,
  onClick,
}: {
  conversation: ConversationWithCustomer;
  active: boolean;
  onClick: () => void;
}) {
  const customer = conversation.end_customers;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full flex-col gap-1 border-b border-border p-3 text-left transition-colors",
        active ? "bg-muted" : "hover:bg-muted/60",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{customer?.name || customer?.phone || "Unbekannt"}</span>
        <ConversationBadge status={conversation.status} />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{CHANNEL_LABEL[conversation.channel] ?? conversation.channel}</span>
        <span>{conversation.last_inbound_at ? formatDateTime(conversation.last_inbound_at) : "–"}</span>
      </div>
    </button>
  );
}

function ChatPanel({
  conversation,
  clientId,
  onBack,
}: {
  conversation: ConversationWithCustomer;
  clientId: string | undefined;
  onBack: () => void;
}) {
  const { data: messages, isLoading } = useMessages(conversation.id);
  const updateStatus = useUpdateConversationStatus(clientId);
  const sendReply = useSendManualReply();
  const [replyText, setReplyText] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const windowExpired = conversation.last_inbound_at ? hoursSince(conversation.last_inbound_at) > 24 : false;
  const customer = conversation.end_customers;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border p-3">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground md:hidden">
            ←
          </button>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{customer?.name || customer?.phone || "Unbekannt"}</div>
            <div className="text-xs text-muted-foreground">{customer?.phone}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ConversationBadge status={conversation.status} />
          {conversation.status === "human_handoff" ? (
            <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: conversation.id, status: "ai_active" })}>
              Zurück an KI
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: conversation.id, status: "human_handoff" })}>
              Übernehmen
            </Button>
          )}
        </div>
      </div>

      {windowExpired && (
        <div className="flex items-center gap-2 border-b border-border bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Freitext nicht mehr möglich – WhatsApp-Fenster abgelaufen (letzte eingehende Nachricht vor über 24h).
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {isLoading && <div className="text-sm text-muted-foreground">Lädt …</div>}
        <div className="flex flex-col gap-2">
          {(messages ?? []).map((m) => (
            <div key={m.id} className={cn("flex", m.direction === "inbound" ? "justify-start" : "justify-end")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                  m.direction === "inbound" ? "bg-muted text-foreground" : "bg-primary text-primary-foreground",
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <div className={cn("mt-1 text-[10px] opacity-70", m.direction === "outbound" && "text-right")}>
                  {m.sender !== "customer" && <span className="mr-1 uppercase">{m.sender}</span>}
                  {formatTime(m.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border p-3">
        {(() => {
          const notWhatsapp = conversation.channel !== "whatsapp";
          const disabled = notWhatsapp || windowExpired || sendReply.isPending;
          const reason = notWhatsapp
            ? "Manuelle Antworten sind aktuell nur für WhatsApp-Konversationen möglich"
            : windowExpired
              ? "24h-Fenster abgelaufen"
              : undefined;

          async function handleSend() {
            if (!replyText.trim()) return;
            try {
              await sendReply.mutateAsync({ conversationId: conversation.id, body: replyText.trim() });
              setReplyText("");
            } catch (err) {
              toast.error("Nachricht konnte nicht gesendet werden", { description: (err as Error).message });
            }
          }

          return (
            <div className="flex gap-2" title={reason}>
              <Textarea
                className="min-h-0 flex-1 resize-none"
                rows={2}
                placeholder="Manuell antworten …"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                disabled={disabled}
              />
              <Button size="icon" disabled={disabled || !replyText.trim()} onClick={() => void handleSend()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
