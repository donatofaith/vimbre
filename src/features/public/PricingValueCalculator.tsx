import { useState } from 'react'
import { plans } from './landing-content'

const money = (amount: number) => new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(amount)

export function PricingValueCalculator() {
  const [handovers, setHandovers] = useState('')
  const [hours, setHours] = useState('')
  const [hourlyCost, setHourlyCost] = useState('')
  const [planName, setPlanName] = useState('Starter')
  const plan = plans.find(item => item.name === planName && item.amount !== null)
  const validInput = [handovers, hours, hourlyCost].every(value =>
    value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) > 0
  )
  const timeCost = validInput ? Number(handovers) * Number(hours) * Number(hourlyCost) : null
  const annualPlanCost = plan?.amount == null ? null : plan.amount * 12
  const difference = timeCost === null || annualPlanCost === null ? null : timeCost - annualPlanCost

  return <section className="rf-calculator" aria-labelledby="rf-calculator-title">
    <div className="rf-calculator-copy">
      <span className="rs-eyebrow">Your numbers, not industry averages</span>
      <h3 id="rf-calculator-title">What does a bad handover cost your team?</h3>
      <p>Estimate the time cost using figures you enter. This compares your estimate with the listed plan price; it does not promise Vimbre will remove every lost hour.</p>
    </div>
    <form className="rf-calculator-form" onSubmit={event => event.preventDefault()}>
      <label>Handovers per year<input aria-label="Handovers per year" type="number" min="0.1" step="any" value={handovers} onChange={event => setHandovers(event.target.value)} placeholder="Your estimate" required /></label>
      <label>Hours lost per handover<input aria-label="Hours lost per handover" type="number" min="0.1" step="any" value={hours} onChange={event => setHours(event.target.value)} placeholder="Your estimate" required /></label>
      <label>Hourly cost (£)<input aria-label="Hourly cost in pounds" type="number" min="0.1" step="any" value={hourlyCost} onChange={event => setHourlyCost(event.target.value)} placeholder="Your estimate" required /></label>
      <label>Compare with<select aria-label="Compare with plan" value={planName} onChange={event => setPlanName(event.target.value)}>{plans.filter(item => item.amount !== null).map(item => <option key={item.name} value={item.name}>{item.name} · {item.price}/month</option>)}</select></label>
    </form>
    <div className="rf-calculator-result" aria-live="polite" aria-atomic="true">
      {timeCost === null || annualPlanCost === null ? <>
        <span className="rf-calculator-result-label">Your estimate appears here</span>
        <p>Enter your own numbers above to compare the estimated annual time cost with a listed annual plan price.</p>
      </> : <>
        <span className="rf-calculator-result-label">Estimated time cost per year</span>
        <strong>{money(timeCost)}</strong>
        <div className="rf-calculator-compare"><span>{planName} at listed monthly price × 12</span><strong>{money(annualPlanCost)}</strong></div>
        <p>{difference! >= 0
          ? 'Your estimate is ' + money(difference!) + ' above the annualized plan price.'
          : 'Your estimate is ' + money(Math.abs(difference!)) + ' below the annualized plan price.'}</p>
      </>}
    </div>
    <p className="rf-calculator-disclaimer">Uses your own estimates and the listed company price. It excludes taxes, setup, and any effects not entered above. Plan subscriptions are not active yet.</p>
  </section>
}
