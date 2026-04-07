/**
 * Claude API service — all insight generation goes through here.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { InsightType } from '@/types'

const client = new Anthropic()

interface GenerateInsightParams {
  type: InsightType
  playerUsername: string
  context: Record<string, unknown>
}

export async function generateInsight({
  type,
  playerUsername,
  context,
}: GenerateInsightParams): Promise<string> {
  const prompt = buildPrompt(type, playerUsername, context)

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const block = message.content[0]
  if (block.type !== 'text') {
    throw new Error('Unexpected response type from Claude API')
  }
  return block.text
}

function buildPrompt(
  type: InsightType,
  playerUsername: string,
  context: Record<string, unknown>
): string {
  const contextJson = JSON.stringify(context, null, 2)

  switch (type) {
    case 'legend_chemistry':
      return `You are an Apex Legends ranked coach. Analyze the legend pairing data for ${playerUsername} and provide a concise, actionable insight about which legend combinations perform best for them.\n\nData:\n${contextJson}\n\nRespond in 2-3 sentences.`

    case 'session_fatigue':
      return `You are an Apex Legends ranked coach. Analyze the session performance data for ${playerUsername} and identify when their performance starts to drop within a session.\n\nData:\n${contextJson}\n\nRespond in 2-3 sentences with a specific recommendation.`

    case 'ranked_momentum':
      return `You are an Apex Legends ranked coach. Analyze the ranked LP trend data for ${playerUsername} and identify momentum patterns or tilt risk.\n\nData:\n${contextJson}\n\nRespond in 2-3 sentences.`

    case 'squad_role_gap':
      return `You are an Apex Legends ranked coach. Analyze the squad composition data for ${playerUsername} and identify role coverage gaps that correlate with worse outcomes.\n\nData:\n${contextJson}\n\nRespond in 2-3 sentences with a specific recommendation.`
  }
}
