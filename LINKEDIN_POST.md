# LinkedIn posts — two variants
Pick one. Both fit within LinkedIn's 3000-character limit; both lead with a hook that survives the "...see more" truncation on mobile (first ~140 characters).

LinkedIn renders plain text only — no Markdown formatting in feed posts. Bullets below use `→`. Bold/italic in source is for your reference only; paste plain text into LinkedIn.

---

## Option A — The contrarian hook (~2,400 chars)

> Best for engagement. Rides the viral wave of Thariq Shihipar's HTML post and positions your tools as the answer. Strong opinion = strong comments = algorithm boost.
```
Anthropic just told the world to stop writing documentation in Markdown.

Last month, Thariq Shihipar from the Claude Code team published "The Unreasonable Effectiveness of HTML in Claude Code." 10.9 million views in 48 hours. The take that traveled: Markdown is dead, HTML is the new default for AI output.

He's half right.

His actual claim was about deliverables — interactive mockups, visual specs, throwaway micro-tools, design systems. For those, HTML beats Markdown.

But "HTML beats Markdown for deliverables" is NOT "HTML beats Markdown for documentation." And the moment teams conflate the two, the AIDLC pipeline starts paying real costs:

→ AI editing gets fragile. Ask Claude to add a section to a 600-line responsive HTML page and you get layout regressions, broken tags, and a 40-line diff nobody can review.

→ Git diffs become unreviewable. A 2-line Markdown change vs. a 200-line HTML diff full of tag noise — one gets reviewed in 30 seconds, the other gets rubber-stamped.

→ Token cost compounds. Source docs get re-read 50 times across a year. A 30–50% HTML tax on every round-trip is real money.

→ Universal rendering breaks. Markdown works identically in GitHub, GitLab, Azure DevOps, Notion, Confluence, Slack. HTML in a wiki gets sanitized, squashed, or stripped.

The mental model that works:

Markdown is source.
HTML, PDF, DOCX, interactive mockups are presentations.

Treating HTML as a source format is the same category error as treating a minified JavaScript bundle as source code.

Anthropic's own internal source files — CLAUDE.md, SKILL.md, agent definitions — are still Markdown. The HTML they produce is OUTPUT, not INPUT.

If you want Thariq's "rich visual format" engagement without the documentation tax, you don't switch source formats. You render Markdown into a richer surface at the moment a human reads it.

That's why we built and use two VS Code extensions together:

→ RTF Markdown Editor — Word-like WYSIWYG editing on top of .md files. Bold, tables, RTL/Hebrew/Arabic, one-click export to DOCX/PDF/HTML. AI generates the source; humans get a polished view.

→ Mermaid NG — Visual Editor — drag-and-drop visual editing of Mermaid diagrams embedded in your Markdown. The canvas IS the text source. Edit visually, commit as text.

Both free. Both MIT-licensed. Both mostly offline.

Full write-up with day-in-the-life walk-throughs for business analysts, project managers, architects, and developers is in the article linked in the first comment.

Question for you: is your team treating HTML as a source format, or only as a deliverable?

#AIDLC #Markdown #Mermaid #VSCode #ClaudeCode

```
**First-comment link** (LinkedIn's algorithm penalizes posts with external links; putting the link in the first comment by yourself avoids that):

```
Full article on Medium: [paste your Medium URL here]

Project landing pages:
→ https://nextgenpowertoys.github.io/rtf-markdown-editor/
→ https://nextgenpowertoys.github.io/mermaid-visual-editor/

```

---

## Option B — The product-focused short post (~950 chars)

> Best for clean conversion. Less polarizing, more "this is what we built." Use this if you'd rather not engage Thariq's piece directly.
```
Two VS Code extensions changed how my team works with AI-generated documentation.

The problem: AI gives us a wall of Markdown and Mermaid. Stakeholders want Word, PDF, polished visuals. The handoff costs hours every week.

The fix:

→ RTF Markdown Editor — Word-like WYSIWYG for .md files. Bold, tables, RTL/Hebrew/Arabic, one-click export to DOCX/PDF/HTML. Mermaid diagrams embedded as PNGs. Source stays Markdown.

→ Mermaid NG — Visual Editor — drag-and-drop editing of Mermaid diagrams inside your Markdown files. The canvas IS the source. Edit visually, commit as text.

Together they close the gap between what AI produces and what your stakeholders need to read — without ever leaving Markdown as the source of truth.

Both free. Both MIT. Both mostly offline. Both for VS Code.

If your AIDLC pipeline still ends with someone manually retyping AI output into Word at 4pm on a Friday, install these this week.

Links in the comments.

#AIDLC #Markdown #Mermaid #VSCode #DevTools

```
**First comment**:

```
→ https://nextgenpowertoys.github.io/rtf-markdown-editor/
→ https://nextgenpowertoys.github.io/mermaid-visual-editor/

Full write-up: [paste your Medium URL here]

```

---

## Publishing tips
- **Post on Tuesday–Thursday, 8–10am in your audience's timezone** — peak LinkedIn engagement.

- **First 140 characters must hook** — they're the only part visible before "see more" on mobile.

- **Don't use emojis** unless your audience expects them; engineering audiences read them as noise.

- **Pin the first-comment link** — keeps it at the top regardless of new comments.

- **Reply to every comment in the first hour** — boosts the post's distribution sharply.

- **5 hashtags is the sweet spot** — more dilutes, fewer caps your reach. The five chosen here (`#AIDLC #Markdown #Mermaid #VSCode #ClaudeCode`) cover the AI, format, tool, and ecosystem angles.

- **Carousel option**: if you want more reach, convert Option A into a 6–8 slide carousel — hook on slide 1, four cost-of-HTML points on slides 2–5, source-vs-presentation mental model on slide 6, tools on slide 7, CTA on slide 8. Carousels currently outperform text posts ~2x on LinkedIn.

## If you want a LinkedIn Article instead of a feed post
The full Medium piece works as a LinkedIn Article almost unchanged — LinkedIn Articles support headings, lists, images, and embedded links. Paste the Medium post into LinkedIn's article editor, swap the Medium-specific tags at the bottom for a single line of LinkedIn hashtags, and you have a second distribution channel pointing back to the same content.