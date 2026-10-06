import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ThemeTokens } from '../../utils/settings';
import { TutorMessageList } from './TutorMessageList';

vi.mock('../../utils/glassStyles', () => ({
  chatBubbleStyle: () => ({}),
}));

vi.mock('../MathMessage', () => ({
  MathMessage: ({ content }: { content: string }) => <div>{content}</div>,
}));

const t = <T extends string>(_zh: T, en: T): T => en;
const tokens = {} as ThemeTokens;

describe('TutorMessageList diagnosis badge', () => {
  it('renders a diagnosis badge when diagnosis is present', () => {
    render(
      <TutorMessageList
        messages={[
          {
            id: 'a1',
            role: 'assistant',
            content: 'Review this step.',
            diagnosis: {
              error_type: 'concept_error',
              is_correct: false,
              skills_updated: [
                {
                  skill_id: 'algebra',
                  skill_name: 'Algebra',
                  mastery_score: 0.1552,
                  mastery_before: null,
                },
              ],
            },
          },
        ]}
        materialContext={null}
        isSending={false}
        language="en"
        tokens={tokens}
        t={t}
      />,
    );

    const text = screen.getByTestId('diagnosis-badge').textContent;
    expect(text).toContain('Diagnosed · Concept error');
    expect(text).toContain('Algebra new → 0.16');
  });

  it('renders mastery before and after values', () => {
    render(
      <TutorMessageList
        messages={[
          {
            id: 'a1',
            role: 'assistant',
            content: 'Recompute this.',
            diagnosis: {
              error_type: 'calculation_error',
              is_correct: false,
              skills_updated: [
                {
                  skill_id: 'geometry',
                  skill_name: 'Geometry',
                  mastery_score: 0.37,
                  mastery_before: 0.42,
                },
              ],
            },
          },
        ]}
        materialContext={null}
        isSending={false}
        language="en"
        tokens={tokens}
        t={t}
      />,
    );

    const text = screen.getByTestId('diagnosis-badge').textContent;
    expect(text).toContain('Calculation error');
    expect(text).toContain('Geometry 0.42 → 0.37');
  });

  it('does not render diagnosis for missing diagnosis or user messages', () => {
    render(
      <TutorMessageList
        messages={[
          {
            id: 'u1',
            role: 'user',
            content: 'My answer',
            diagnosis: {
              error_type: 'concept_error',
              is_correct: false,
              skills_updated: [],
            },
          },
          {
            id: 'a1',
            role: 'assistant',
            content: 'No diagnosis here.',
          },
        ]}
        materialContext={null}
        isSending={false}
        language="en"
        tokens={tokens}
        t={t}
      />,
    );

    expect(screen.queryByTestId('diagnosis-badge')).toBeNull();
  });
});
