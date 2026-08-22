/**
 * Attribution for the artwork this site renders and the library it renders on.
 *
 * Deliberately not a full dependency licence listing. A hand-maintained list that
 * claims to cover every package is wrong the first time one is added, and doing
 * it honestly needs a generator. This covers what the site actually redistributes
 * to a visitor as pictures — which is also the set with real obligations attached
 * — and `/credits` says so in its opening line.
 *
 * One source for two readers: the credits page renders all of it, and each icon
 * picker renders a one-line version linking to the matching section. Adding an
 * icon set means adding an entry here: `IconSet.credit` is required and resolved
 * from this file at module load, which throws on an unknown id. See `docs/adr/0004-attribution.md`.
 */

type Credit = {
  /** Stable key, also the anchor on the credits page and the React list key. */
  id: string
  name: string
  href: string
  /** What it provides here, in one line. */
  use: string
  /** Who holds the rights to the work itself. */
  holder: string
  /** Licence as declared by the source. */
  license: string
  /**
   * How the work reaches this project, where that differs from who made it.
   * The AWS artwork is Amazon's; the package that delivers it is somebody
   * else's, under a different licence, and crediting only one of them would be
   * wrong in both directions.
   */
  via?: {
    name: string
    href: string
    author: string
    license: string
  }
  /** Reproduced verbatim where the licence requires it. */
  notice?: string
  /** Trademark and no-endorsement wording, where the work is a brand asset. */
  disclaimer?: string
}

/**
 * The standard BSD-3-Clause terms, with Cloudflare as the holder.
 *
 * Written out here rather than copied from the package because
 * `@cloudflare/component-icon` ships no LICENSE file — its `package.json`
 * declares `BSD-3-Clause` and nothing else. Clause 2 is the one that puts this
 * page in the codebase at all: binary redistribution has to reproduce these
 * terms in materials provided with the distribution, and serving their SVGs is
 * redistribution.
 */
const BSD_3_CLAUSE = `Copyright (c) Cloudflare, Inc. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`

const ISC = `ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`

const CREDITS: readonly Credit[] = [
  {
    id: "aws-icons",
    name: "AWS Architecture Icons",
    href: "https://aws.amazon.com/architecture/icons/",
    use: "The AWS service icons in the draw tool.",
    holder: "Amazon Web Services, Inc.",
    license: "AWS Architecture Icons terms — permitted for architecture diagrams, with restrictions on redistribution",
    via: {
      name: "aws-icons",
      href: "https://github.com/MKAbuMattar/aws-icons",
      author: "Mohammad Abu Mattar",
      license: "MIT",
    },
    disclaimer:
      "AWS and its service marks are trademarks of Amazon Web Services, Inc. or its affiliates. This site is not affiliated with, endorsed by, or sponsored by AWS.",
  },
  {
    id: "cloudflare-icons",
    name: "Cloudflare product icons",
    href: "https://www.npmjs.com/package/@cloudflare/component-icon",
    use: "The Cloudflare product icons in the draw tool, recoloured to Cloudflare's orange.",
    holder: "Cloudflare, Inc.",
    license: "BSD-3-Clause",
    notice: BSD_3_CLAUSE,
    disclaimer:
      "Cloudflare and its product names are trademarks of Cloudflare, Inc. This site is not affiliated with, endorsed by, or sponsored by Cloudflare.",
  },
  {
    id: "tldraw",
    name: "tldraw",
    href: "https://tldraw.dev",
    use: "The infinite canvas the draw tool is built on.",
    holder: "tldraw Inc.",
    license: "tldraw license — see the watermark on the canvas",
  },
  {
    id: "lucide",
    name: "Lucide",
    href: "https://lucide.dev",
    use: "The interface icons throughout the site.",
    holder: "Lucide Icons and Contributors",
    license: "ISC",
    notice: ISC,
  },
]

/**
 * Ends a fragment with exactly one full stop.
 *
 * Several holders are companies whose legal name already ends in one — "Amazon
 * Web Services, Inc." — so composing a sentence around them produces "Inc..".
 * Trimming it in the data instead would mean storing the name wrongly, and every
 * consumer that renders a credit hits this, so it lives beside the data.
 */
const sentence = (text: string): string => (text.endsWith(".") ? text : `${text}.`)

const creditById = new Map(CREDITS.map(credit => [credit.id, credit]))

const getCredit = (id: string): Credit | undefined => creditById.get(id)

export { CREDITS, getCredit, sentence }
export type { Credit }
