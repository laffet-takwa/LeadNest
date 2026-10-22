/**
 * The AI assistant workspace.
 *
 * Three capabilities, each backed by a real endpoint. When the backend has
 * no provider configured the page shows a clear unavailable state instead of
 * pretending to work.
 */

import {
  AlertTriangle,
  Check,
  Copy,
  FileText,
  History,
  Mail,
  RefreshCw,
  Sparkles,
  Trash2,
  UserSearch,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/page-header'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/badge'
import { Combobox } from '@/components/ui/combobox'
import { Input, Textarea } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays'
import { Pagination } from '@/components/data-display/list-controls'
import { EmptyState, ErrorState } from '@/components/feedback/state'
import {
  useAIHistory,
  useCustomerSummary,
  useEmailDraft,
  useFollowUpSuggestions,
} from '@/features/ai/hooks/use-ai'
import { useCustomers } from '@/features/customers/hooks/use-customers'
import { useDeals } from '@/features/deals/hooks/use-deals'
import { ApiError } from '@/lib/api/client'
import { formatRelative } from '@/lib/utils/date'
import { cn } from '@/lib/utils'

const TONES = [
  { value: 'professional and friendly', label: 'Professional' },
  { value: 'warm and conversational', label: 'Warm' },
  { value: 'brief and direct', label: 'Brief' },
  { value: 'enthusiastic', label: 'Enthusiastic' },
]

export function AIPage() {
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<'draft' | 'summary' | 'suggestions' | 'history'>('draft')
  const [customerId, setCustomerId] = useState(searchParams.get('customer_id') ?? '')

  const { data: customers } = useCustomers({ limit: 100, sort: 'full_name', order: 'asc' })

  return (
    <>
      <PageHeader
        title="AI assistant"
        description="Draft a follow-up, summarise a relationship, or find out who needs attention."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-ink-secondary">
            <Sparkles className="size-3.5 text-accent-violet-strong" aria-hidden="true" />
            Suggestions, not facts
          </span>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-ink-secondary">Customer</span>
        <Combobox
          label="Customer"
          value={customerId}
          onValueChange={setCustomerId}
          options={(customers?.data ?? []).map((customer) => ({
            value: customer.id,
            label: customer.full_name,
            description: customer.company,
          }))}
          placeholder="Choose a customer"
          className="w-full sm:w-72"
        />
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
        <TabsList>
          <TabsTrigger value="draft">
            <Mail className="size-4" aria-hidden="true" />
            Email draft
          </TabsTrigger>
          <TabsTrigger value="summary">
            <FileText className="size-4" aria-hidden="true" />
            Customer summary
          </TabsTrigger>
          <TabsTrigger value="suggestions">
            <UserSearch className="size-4" aria-hidden="true" />
            Follow-ups
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="size-4" aria-hidden="true" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="draft">
          <EmailDraftPanel customerId={customerId} />
        </TabsContent>
        <TabsContent value="summary">
          <CustomerSummaryPanel customerId={customerId} />
        </TabsContent>
        <TabsContent value="suggestions">
          <FollowUpPanel />
        </TabsContent>
        <TabsContent value="history">
          <HistoryPanel />
        </TabsContent>
      </Tabs>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Email draft                                                                */
/* -------------------------------------------------------------------------- */

function EmailDraftPanel({ customerId }: { customerId: string }) {
  const generate = useEmailDraft()
  const { data: deals } = useDeals({ limit: 100 })
  const [dealId, setDealId] = useState('')
  const [tone, setTone] = useState(TONES[0]?.value ?? 'professional and friendly')
  const [notes, setNotes] = useState('')
  const [draft, setDraft] = useState('')
  const [subject, setSubject] = useState('')

  const customerDeals = (deals?.data ?? []).filter(
    (deal) => !customerId || deal.customer_id === customerId,
  )

  const result = generate.data

  useEffect(() => {
    if (result) {
      setDraft(result.draft)
      setSubject(result.subject)
    }
  }, [result])

  const onGenerate = () => {
    if (!customerId) {
      toast.error('Choose a customer first')
      return
    }
    generate.mutate({
      customer_id: customerId,
      deal_id: dealId || undefined,
      tone,
      notes: notes || undefined,
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Draft settings</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="ai-deal" className="text-sm font-medium text-ink">
              Deal
            </label>
            <Select value={dealId || undefined} onValueChange={setDealId}>
              <SelectTrigger id="ai-deal" aria-label="Deal">
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                {customerDeals.map((deal) => (
                  <SelectItem key={deal.id} value={deal.id}>
                    {deal.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ai-tone" className="text-sm font-medium text-ink">
              Tone
            </label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger id="ai-tone" aria-label="Tone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ai-notes" className="text-sm font-medium text-ink">
              Extra context
            </label>
            <Textarea
              id="ai-notes"
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Mention the new pricing plan and the September deadline."
            />
          </div>

          <Button className="w-full" onClick={onGenerate} loading={generate.isPending}>
            <Sparkles className="size-4" aria-hidden="true" />
            Generate draft
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Draft</CardTitle>
            <p className="mt-0.5 text-xs text-ink-secondary">
              Edit before you send. LeadNest never sends the email for you.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              disabled={!draft}
              onClick={() => {
                void navigator.clipboard
                  .writeText(subject ? `Subject: ${subject}\n\n${draft}` : draft)
                  .then(() => toast.success('Draft copied to the clipboard'))
                  .catch(() => toast.error('The clipboard is not available'))
              }}
              icon={<Copy className="size-3.5" />}
            >
              Copy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!draft}
              onClick={() => {
                setDraft('')
                setSubject('')
              }}
              icon={<Trash2 className="size-3.5" />}
            >
              Clear
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onGenerate}
              loading={generate.isPending}
              aria-label="Regenerate the draft"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          {generate.error ? (
            <ErrorState
              title={
                generate.error instanceof ApiError ? aiErrorTitle(generate.error) : 'Generation failed'
              }
              description={generate.error.message}
              onRetry={onGenerate}
            />
          ) : null}

          {subject ? (
            <div className="space-y-1.5">
              <label htmlFor="ai-subject" className="text-xs font-medium text-ink-secondary">
                Subject
              </label>
              <Input
                id="ai-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="ai-draft" className="text-xs font-medium text-ink-secondary">
                Body
              </label>
              {draft ? (
                <span className="text-2xs tabular-nums text-ink-muted">
                  {draft.length.toLocaleString()} characters
                </span>
              ) : null}
            </div>
            {generate.isPending ? (
              <div className="space-y-2" role="status" aria-label="Generating the draft">
                <div className="skeleton h-3 w-full" />
                <div className="skeleton h-3 w-11/12" />
                <div className="skeleton h-3 w-4/5" />
              </div>
            ) : draft ? (
              <Textarea
                id="ai-draft"
                rows={12}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="font-[inherit] leading-relaxed"
              />
            ) : (
              <EmptyState
                icon={Mail}
                title="No draft yet"
                description="Choose a customer and generate a follow-up email. You can edit the result before sending it."
              />
            )}
          </div>

          {result?.warning ? (
            <p className="flex items-start gap-2 rounded-input bg-accent-violet-soft px-3 py-2 text-xs text-accent-violet-strong">
              <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              {result.warning}
            </p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Customer summary                                                            */
/* -------------------------------------------------------------------------- */

function CustomerSummaryPanel({ customerId }: { customerId: string }) {
  const generate = useCustomerSummary()
  const result = generate.data

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Customer summary</CardTitle>
          <p className="mt-0.5 text-xs text-ink-secondary">
            A short brief of the customer, their deals and their recent activity.
          </p>
        </div>
        <Button
          onClick={() => {
            if (!customerId) {
              toast.error('Choose a customer first')
              return
            }
            generate.mutate({ customer_id: customerId })
          }}
          loading={generate.isPending}
        >
          <Sparkles className="size-4" aria-hidden="true" />
          Generate summary
        </Button>
      </CardHeader>
      <CardBody>
        {generate.error ? (
          <ErrorState
            title={
              generate.error instanceof ApiError ? aiErrorTitle(generate.error) : 'Generation failed'
            }
            description={generate.error.message}
          />
        ) : generate.isPending ? (
          <div className="space-y-2" role="status" aria-label="Generating the summary">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="skeleton h-3 w-full" />
            ))}
          </div>
        ) : result ? (
          <div className="space-y-4">
            <div className="rounded-input border border-accent-violet/20 bg-accent-violet-soft/50 px-3.5 py-2.5">
              <p className="text-xs font-medium text-accent-violet-strong">
                Generated by {result.model || 'the AI provider'} — verify before relying on it.
              </p>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-secondary">
              {result.summary}
            </p>
          </div>
        ) : (
          <EmptyState
            icon={FileText}
            title="No summary yet"
            description="Choose a customer above and generate a summary of your relationship with them."
          />
        )}
      </CardBody>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/* Follow-up suggestions                                                       */
/* -------------------------------------------------------------------------- */

function FollowUpPanel() {
  const generate = useFollowUpSuggestions()
  const result = generate.data

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Follow-up suggestions</CardTitle>
          <p className="mt-0.5 text-xs text-ink-secondary">
            Customers who may have gone quiet, based on your CRM data.
          </p>
        </div>
        <Button onClick={() => generate.mutate({ limit: 10 })} loading={generate.isPending}>
          <Sparkles className="size-4" aria-hidden="true" />
          Find follow-ups
        </Button>
      </CardHeader>
      <CardBody>
        {generate.error ? (
          <ErrorState
            title={
              generate.error instanceof ApiError ? aiErrorTitle(generate.error) : 'Generation failed'
            }
            description={generate.error.message}
            onRetry={() => generate.mutate({ limit: 10 })}
          />
        ) : generate.isPending ? (
          <div className="space-y-2" role="status" aria-label="Looking for follow-ups">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="skeleton h-16" />
            ))}
          </div>
        ) : result && result.suggestions.length > 0 ? (
          <ul className="space-y-2">
            {result.suggestions.map((suggestion) => (
              <li
                key={`${suggestion.customer_id}-${suggestion.customer_name}`}
                className="flex items-start gap-3 rounded-card border border-border p-3"
              >
                <Avatar name={suggestion.customer_name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-ink">{suggestion.customer_name}</p>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-2xs font-medium capitalize',
                        suggestion.priority === 'high'
                          ? 'bg-danger-soft text-danger'
                          : suggestion.priority === 'medium'
                            ? 'bg-warning-soft text-warning'
                            : 'bg-surface-sunken text-ink-secondary',
                      )}
                    >
                      {suggestion.priority}
                    </span>
                  </div>
                  {suggestion.reason ? (
                    <p className="mt-0.5 text-xs text-ink-secondary">{suggestion.reason}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : result ? (
          <EmptyState
            icon={Check}
            title="Everyone is up to date"
            description="No customer looks overdue for a follow-up right now."
          />
        ) : (
          <EmptyState
            icon={UserSearch}
            title="No suggestions yet"
            description="Ask LeadNest to look through your customers and find the ones that need attention."
          />
        )}
      </CardBody>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/* History                                                                     */
/* -------------------------------------------------------------------------- */

function HistoryPanel() {
  const [offset, setOffset] = useState(0)
  const limit = 20
  const { data, isLoading, error, refetch } = useAIHistory({ limit, offset })

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>AI history</CardTitle>
          <p className="mt-0.5 text-xs text-ink-secondary">
            Every generation your company has requested.
          </p>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        {error ? (
          <div className="p-4">
            <ErrorState description={error.message} onRetry={() => void refetch()} />
          </div>
        ) : isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="skeleton h-12" />
            ))}
          </div>
        ) : (data?.data.length ?? 0) === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={History}
              title="No AI activity yet"
              description="Generated drafts, summaries and suggestions will be listed here."
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {data?.data.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-control bg-accent-violet-soft text-accent-violet-strong">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium capitalize text-ink">
                    {item.interaction_type.replace(/_/g, ' ')}
                  </p>
                  {item.response ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-secondary">{item.response}</p>
                  ) : null}
                  <p className="mt-1 text-2xs text-ink-muted">
                    {item.model ? `${item.model} · ` : ''}
                    {item.duration_ms ? `${item.duration_ms} ms · ` : ''}
                    {formatRelative(item.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      {data && data.meta.total > data.meta.limit ? (
        <div className="border-t border-border p-3">
          <Pagination
            total={data.meta.total}
            limit={data.meta.limit}
            offset={data.meta.offset}
            onOffsetChange={setOffset}
          />
        </div>
      ) : null}
    </Card>
  )
}

/** Turns an AI-specific error code into a readable title. */
function aiErrorTitle(error: ApiError): string {
  switch (error.code) {
    case 'AI_NOT_CONFIGURED':
      return 'AI is not configured'
    case 'AI_TIMEOUT':
      return 'The provider timed out'
    case 'RATE_LIMITED':
      return 'Too many requests'
    default:
      return 'The AI provider returned an error'
  }
}
