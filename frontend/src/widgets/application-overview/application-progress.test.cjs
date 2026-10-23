const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const root = path.resolve(__dirname, '../..')

function load(relative, dependencies = {}) {
  const file = path.join(root, relative)
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2023,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(`(function(require, module, exports) { ${compiled}\n})`, {}, { filename: file })((id) => {
    if (id === 'react/jsx-runtime') return require(id)
    assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`)
    return dependencies[id]
  }, module, module.exports)
  return module.exports
}

const { getApplicationProgress } = load('entities/loan-application/get-application-progress.ts')
const { formatDate } = load('shared/lib/format-date.ts')
const codes = ['SUBMITTED', 'REVIEW', 'DECISION', 'OFFER', 'SIGNING', 'ISSUED']
const titles = ['Заявка', 'Проверка', 'Статус', 'Предложение', 'Подписание', 'Выдача']
const application = {
  id: 7, amount: 100000, termDays: 30, rate: 24.5, purpose: 'Оборотные средства',
  decision: 'ALTERNATIVE_OFFER', finalRate: null,
  internalScore: 66, riskClass: 'B', scoring: null,
  createdAt: '2026-10-01T12:00:00Z', status: 'OFFER_READY',
}
const offer = {
  id: 9, amount: 90000, termDays: 60, finalRate: 25.25,
  monthlyPayment: 48735.62, validUntil: '2099-12-31', status: 'ACTIVE',
}
const styles = new Proxy({}, { get: (_, key) => String(key) })
const text = ({ children, tag = 'span', ...props }) => React.createElement(tag, {
  'aria-current': props['aria-current'], role: props.role,
}, children)
const Typography = { Text: text, TitleResponsive: text }
const Button = ({ children }) => React.createElement('button', null, children)

test('all real statuses map to exactly six ordered product stages', () => {
  const states = {
    IN_REVIEW: ['DONE', 'CURRENT', 'PENDING', 'PENDING', 'PENDING', 'PENDING'],
    OFFER_READY: ['DONE', 'DONE', 'CURRENT', 'PENDING', 'PENDING', 'PENDING'],
    ACCEPTED: ['DONE', 'DONE', 'DONE', 'DONE', 'DONE', 'CURRENT'],
    DECLINED: ['DONE', 'DONE', 'CURRENT', 'PENDING', 'PENDING', 'PENDING'],
  }
  for (const [status, expected] of Object.entries(states)) {
    const result = getApplicationProgress(status)
    assert.deepEqual(Array.from(result, (stage) => stage.code), codes)
    assert.deepEqual(Array.from(result, (stage) => stage.title), titles)
    assert.deepEqual(Array.from(result, (stage) => stage.state), expected)
  }
})

test('progress does not share mutable results or mark issuance complete', () => {
  const first = getApplicationProgress('ACCEPTED')
  first[0].state = 'PENDING'
  const second = getApplicationProgress('ACCEPTED')
  assert.equal(second[0].state, 'DONE')
  assert.equal(second[5].state, 'CURRENT')
})

function overview({ status = 'IN_REVIEW', provided = true, empty = false, failed = false, applicationsFailed = false, applicationOverride = {}, offerOverride = {}, officerComment = 'Недостаточно данных о доходах', aiComment = 'Автоматическое заключение скоринга', activeLoan = null } = {}) {
  const renderedSteps = []
  const current = { ...application, status, decision: {
    IN_REVIEW: 'MANUAL_REVIEW', OFFER_READY: 'ALTERNATIVE_OFFER', ACCEPTED: 'ALTERNATIVE_OFFER', DECLINED: 'DECLINED',
  }[status], ...applicationOverride }
  const view = { ...current, offer: offerOverride === null ? null : { ...offer, ...offerOverride }, officerComment, aiComment }
  const ApplicationForm = () => null
  const { ApplicationOverview } = load('widgets/application-overview/ui/ApplicationOverview/ApplicationOverview.tsx', {
    react: { ...React, useId: () => 'application-heading', useRef: () => ({ current: null }), useState: () => [true, () => {}] },
    'react-router-dom': { useNavigate: () => () => {} },
    '@alfalab/core-components/button': { Button },
    '@alfalab/core-components/typography': { Typography },
    '@alfalab/core-components/steps': { Steps: (props) => {
      renderedSteps.push(props)
      return React.createElement('div', { 'data-steps': true }, props.children)
    } },
    '@alfalab/icons/glyph/dist/ArrowRightMIcon': { ArrowRightMIcon: () => null },
    '@alfalab/icons/glyph/dist/ClockMIcon': { ClockMIcon: () => null },
    '@/entities/dashboard': { useDashboard: () => ({
      isPending: false, isError: failed, error: failed ? new Error('Ошибка загрузки') : null,
      data: { currentApplication: empty ? null : current, activeLoan: activeLoan ?? (provided ? { id: 99 } : null),
        stages: codes.slice(0, 4).map((code) => ({ code, state: 'DONE' })) },
    }) },
    '@/entities/loan-application': {
      getApplicationProgress,
      applicationStatusLabels: { IN_REVIEW: 'На рассмотрении', OFFER_READY: 'Предложение банка', ACCEPTED: 'Предложение принято', DECLINED: 'Отказ по заявке' },
      applicationDecisionLabels: { INFO_REQUIRED: 'Нужны дополнительные сведения', DECLINED: 'Отказ', APPROVED: 'Одобрено', ALTERNATIVE_OFFER: 'Предложены другие условия', MANUAL_REVIEW: 'Ручная проверка' },
      useApplications: () => ({
        isPending: false, isError: applicationsFailed,
        error: applicationsFailed ? new Error('Не удалось обновить заявки') : null,
        data: [{ ...view, id: 8, officerComment: 'Комментарий другой заявки' }, view],
      }),
    },
    '@/features/accept-offer': { AcceptOffer: () => null },
    '@/features/submit-loan-application': { ApplicationForm },
    '@/shared/config': { ROUTES: { documents: '/documents', credits: '/credits' } },
    '@/shared/lib': { formatDate, formatMoney: (value) => String(value) },
    '@/shared/ui': { Panel: ({ children }) => React.createElement('aside', null, children) },
    './ApplicationOverview.module.scss': { __esModule: true, default: styles },
  })
  const element = ApplicationOverview({ application: provided ? view : undefined })
  return { element, html: renderToStaticMarkup(element), renderedSteps, ApplicationForm }
}

test('overview and details expose six semantic stages and inert visual Steps', () => {
  for (const status of ['IN_REVIEW', 'OFFER_READY', 'ACCEPTED', 'DECLINED']) {
    const { html, renderedSteps } = overview({ status, failed: true })
    assert.equal((html.match(/<ol /g) || []).length, 2)
    assert.equal((html.match(/<li[ >]/g) || []).length, 12)
    assert.equal((html.match(/aria-current="step"/g) || []).length, 4)
    assert.equal((html.match(/inert="" aria-hidden="true"/g) || []).length, 3)
    assert.equal(renderedSteps.length, 3)
    for (const props of renderedSteps) {
      assert.equal(React.Children.count(props.children), 6)
      assert.equal(props.interactive, false)
      assert.equal(props.isMarkCompletedSteps, false)
    }
    assert.ok(!html.includes('Загружаем этапы заявки'))
    assert.ok(html.includes(`${application.termDays} дней`))
    assert.ok(!html.includes('мес.'))
    if (status === 'OFFER_READY') {
      assert.ok(html.includes(`${offer.termDays} дней`))
      assert.ok(!html.includes(`${offer.finalRate}% годовых`))
      assert.ok(html.includes('Срок изменен с 30 до 60 дней'))
      const rateOnly = overview({ status, offerOverride: { amount: application.amount, termDays: application.termDays } })
      assert.ok(rateOnly.html.includes('Банк предложил другие условия'))
    }
  }
})

test('decline is a negative decision, not waiting for an offer', () => {
  const { html, renderedSteps } = overview({ status: 'DECLINED', officerComment: null })
  assert.ok(html.includes('Статус: отказ по заявке'))
  assert.ok(html.includes('Предложение: не выполняется: заявка отклонена'))
  assert.ok(html.includes('Автоматический комментарий: Автоматическое заключение скоринга'))
  const manual = overview({ status: 'DECLINED', officerComment: 'Отказ сотрудника' })
  assert.ok(manual.html.includes('Отказ сотрудника'))
  assert.ok(!manual.html.includes('Автоматическое заключение скоринга'))
  assert.ok(!html.includes('Предложение для этой заявки пока недоступно'))
  for (const props of renderedSteps) {
    assert.equal(props.activeStep, 3)
    assert.equal(props.checkIsStepError(3), true)
    assert.equal(props.checkIsStepError(4), false)
  }
})

test('approved and alternative offers keep status pending client choice with warning styling', () => {
  for (const decision of ['APPROVED', 'ALTERNATIVE_OFFER']) {
    const { html, renderedSteps } = overview({
      status: 'OFFER_READY',
      applicationOverride: { decision, amount: 1500000 },
      offerOverride: { amount: 1500000, termDays: application.termDays },
    })
    assert.ok(html.includes('class="status warning"'))
    assert.ok(html.includes('class="pendingChoice">Статус'))
    assert.ok(html.includes('Статус: ожидает вашего выбора'))
    assert.ok(html.includes('Этап 3 из 6 · Статус · Ожидает выбора'))
    assert.ok(!html.includes('Статус: завершено'))
    assert.ok(html.includes(decision === 'APPROVED' ? 'Банк подготовил предложение' : 'Банк предложил другие условия'))
    for (const props of renderedSteps) {
      assert.equal(props.activeStep, 3)
      assert.equal(props.checkIsStepPositive(2), true)
      assert.equal(props.checkIsStepPositive(3), false)
      assert.equal(props.checkIsStepPositive(4), false)
      assert.equal(props.checkIsStepError(3), false)
    }
  }
  const css = readFileSync(path.join(root, 'widgets/application-overview/ui/ApplicationOverview/ApplicationOverview.module.scss'), 'utf8')
  assert.match(css, /\.warning,\s*\.pendingChoice\s*\{\s*background: var\(--color-light-status-muted-attention\)/)
})

test('cards, hero and details show the creation date separately from offer expiry', () => {
  for (const provided of [true, false]) {
    for (const status of ['IN_REVIEW', 'OFFER_READY', 'ACCEPTED', 'DECLINED']) {
      const { html } = overview({ status, provided })
      for (const section of html.split('<aside>')) {
        assert.ok(section.includes('Дата создания заявки'))
        assert.ok(section.includes(`<time dateTime="${application.createdAt}">${formatDate(application.createdAt)}</time>`))
        if (status === 'OFFER_READY') {
          assert.ok(section.includes(`Предложение действительно до</dt><dd>${formatDate(offer.validUntil)}</dd>`))
        }
      }
    }
  }
})

test('selected application officer comments stay prominent and separate from automated comments in every status', () => {
  const officerComment = '  Условия согласованы сотрудником.\nПроверьте документы.  '
  for (const provided of [true, false]) {
    for (const status of ['IN_REVIEW', 'OFFER_READY', 'ACCEPTED', 'DECLINED']) {
      const { html } = overview({ status, provided, officerComment, applicationsFailed: true })
      for (const section of html.split('<aside>')) {
        assert.ok(section.includes('<strong>Комментарий кредитного специалиста</strong>'))
        assert.ok(section.includes(`<p>${officerComment.trim()}</p>`))
      }
      assert.ok(!html.includes('Автоматическое заключение скоринга'))
      assert.ok(!html.includes('Комментарий другой заявки'))
    }
  }
  for (const officerComment of [null, ' \n ']) {
    const { html } = overview({ status: 'DECLINED', officerComment })
    assert.ok(!html.includes('<strong>Комментарий кредитного специалиста</strong>'))
    assert.ok(html.includes('Автоматический комментарий: Автоматическое заключение скоринга'))
  }
  const missing = overview({ status: 'DECLINED', officerComment: null, aiComment: ' ' })
  assert.ok(missing.html.includes('Причина отказа не указана.'))
})

test('no base or final rate leaks into application summaries or details before signing', () => {
  for (const provided of [true, false]) {
    for (const status of ['IN_REVIEW', 'OFFER_READY', 'DECLINED']) {
      const { html } = overview({ status, provided, applicationOverride: { finalRate: 99.75 } })
      assert.ok(!html.includes('% годовых'))
      assert.ok(!html.includes('Базовая ставка'))
      assert.ok(!html.includes('Итоговая ставка'))
      assert.ok(!html.includes('99.75'))
      assert.ok(!html.includes(String(offer.finalRate)))
    }
  }
})

test('signed application rate comes only from its offer, never from the nullable root rate', () => {
  for (const finalRate of [null, 99.75]) {
    const { html } = overview({ status: 'ACCEPTED', applicationOverride: { finalRate }, offerOverride: { status: 'ACCEPTED' } })
    assert.ok(html.includes(`Итоговая ставка</dt><dd>${offer.finalRate}% годовых`))
    assert.ok(!html.includes('99.75'))
    assert.ok(!html.includes(`${application.rate}% годовых`))
    const missingOffer = overview({ status: 'ACCEPTED', applicationOverride: { finalRate }, offerOverride: null })
    assert.ok(!missingOffer.html.includes('% годовых'))
  }
})

test('an accepted application awaits issuance even with an unrelated dashboard loan', () => {
  const { html, renderedSteps } = overview({ status: 'ACCEPTED' })
  assert.ok(html.includes('Выдача: ожидает выдачи'))
  assert.ok(html.includes('Ожидаем подтверждения выдачи. Деньги еще не зачислены.'))
  for (const props of renderedSteps) {
    assert.equal(props.activeStep, 6)
    assert.equal(props.checkIsStepPositive(5), true)
    assert.equal(props.checkIsStepPositive(6), false)
  }
})

test('active loan retains its own ratePercent and termMonths', () => {
  const { html } = overview({
    provided: false, status: 'ACCEPTED',
    activeLoan: { id: 99, remainingBalance: 70000, principal: 100000, monthlyPayment: 5000, ratePercent: 18.5, termMonths: 24 },
  })
  assert.ok(html.includes('Ставка 18.5% годовых · Срок: 24 мес.'))
  assert.ok(!html.includes(`${offer.finalRate}% годовых`))
})

test('no-application hero composes the public form directly with an h2 heading', () => {
  const { element, ApplicationForm } = overview({ provided: false, empty: true })
  assert.equal(element.type, ApplicationForm)
  assert.equal(element.props.headingTag, 'h2')
})

function acceptance({ expired = false, error = null } = {}) {
  let confirm = false
  let submitted = false
  const requests = []
  const mutation = { isPending: false, isSuccess: false, error }
  const { AcceptOffer } = load('features/accept-offer/ui/AcceptOffer/AcceptOffer.tsx', {
    react: { ...React, useState: () => [confirm, (value) => { confirm = value }], useRef: () => ({
      get current() { return submitted }, set current(value) { submitted = value },
    }) },
    '@tanstack/react-query': {
      useQueryClient: () => ({ invalidateQueries: async () => {} }),
      useMutation: (options) => Object.assign(mutation, {
        mutate: () => { mutation.isPending = true; void options.mutationFn() },
        reset: () => { mutation.error = null },
      }),
    },
    '@alfalab/core-components/button': { Button },
    '@alfalab/core-components/typography': { Typography },
    '@/shared/api': { useApiScope: () => 'client-session', apiEmpty: async (...args) => { requests.push(args) } },
    '@/shared/lib': { formatMoney: (value) => String(value) },
    './AcceptOffer.module.scss': { __esModule: true, default: styles },
  })
  return {
    render: () => AcceptOffer({ offer: { ...offer, validUntil: expired ? '2000-01-01' : offer.validUntil }, application }),
    requests, mutation,
  }
}

test('choosing conditions does not send a request; confirmation sends only the real sign endpoint once', () => {
  const h = acceptance()
  let element = h.render()
  const choiceHtml = renderToStaticMarkup(element)
  assert.ok(choiceHtml.includes('Выбор предложения'))
  assert.ok(!choiceHtml.includes('% годовых'))
  assert.ok(!choiceHtml.includes(String(offer.finalRate)))
  React.Children.toArray(element.props.children).find((child) => child.type === Button).props.onClick()
  assert.equal(h.requests.length, 0)
  element = h.render()
  const html = renderToStaticMarkup(element)
  assert.ok(html.includes('Подписание'))
  for (const value of [offer.amount, offer.termDays, offer.finalRate, offer.monthlyPayment]) assert.ok(html.includes(String(value)))
  assert.ok(html.includes(`на ${offer.termDays} дней по ставке ${offer.finalRate}%`))
  assert.ok(!html.includes('мес.'))
  const confirmButton = React.Children.toArray(element.props.children).find((child) => child.type === Button)
  confirmButton.props.onClick()
  confirmButton.props.onClick()
  assert.equal(h.requests.length, 1)
  assert.equal(h.requests[0][0], '/api/offers/9/sign')
  assert.equal(h.requests[0][1].method, 'POST')
  const pendingButton = React.Children.toArray(h.render().props.children).find((child) => child.type === Button)
  assert.equal(pendingButton.props.disabled, true)
  assert.equal(pendingButton.props.loading, true)
})

test('expired offers cannot be signed and request errors remain visible without success fallback', () => {
  const expired = acceptance({ expired: true })
  assert.ok(renderToStaticMarkup(expired.render()).includes('Предложение недоступно'))
  assert.equal(expired.requests.length, 0)
  const failed = acceptance({ error: new Error('Не удалось подписать') })
  const html = renderToStaticMarkup(failed.render())
  assert.ok(html.includes('role="alert"'))
  assert.ok(html.includes('Не удалось подписать'))
  assert.ok(!html.includes('Предложение принято'))
})

test('returning to conditions cancels only the local choice without signing', () => {
  const h = acceptance()
  let buttons = React.Children.toArray(h.render().props.children).filter((child) => child.type === Button)
  buttons[0].props.onClick()
  buttons = React.Children.toArray(h.render().props.children).filter((child) => child.type === Button)
  buttons[1].props.onClick()
  const html = renderToStaticMarkup(h.render())
  assert.ok(html.includes('Выбор предложения'))
  assert.ok(!html.includes('% годовых'))
  assert.equal(h.requests.length, 0)
})

test('successful signing confirms acceptance but not issued funds', () => {
  const h = acceptance()
  h.mutation.isSuccess = true
  const html = renderToStaticMarkup(h.render())
  assert.ok(html.includes('Предложение принято'))
  assert.ok(html.includes(`Итоговая ставка: ${offer.finalRate}% годовых`))
  assert.ok(html.includes('Ожидаем подтверждения выдачи. Деньги еще не зачислены.'))
  assert.ok(!html.includes('<button'))
})
