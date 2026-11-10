# Phase H audience tags: notes

Tagged only from text already in data/programs.json. No web use.

## Programs per tag
low-income 19, worker 17, member 15, medicaid 14, insured 13, local 12, wic 2, marketplace 1, military 1, employer 0.

## Insurers (program count)
Aetna 2, AmeriHealth Caritas 1, Anthem 1, Blue Cross Blue Shield 1, CareSource 1, Centene / Ambetter 1, Cigna 1, Highmark 1, Humana 1, Kaiser Permanente 1, Molina 1, UPMC 1, UnitedHealthcare 1, Wellpoint 1.

## if-eligible programs left with []
- healthcare-gov-pregnancy-coverage: open to anyone pregnant; Medicaid/CHIP vs Marketplace depends on state and income, so no single tag holds.
- cdc-vaccines-for-children: eligible groups are alternatives (Medicaid, uninsured, underinsured, Native American), not an AND.
- irs-child-tax-credit: child with a valid Social Security number; phases out only at high income.
- ny-empire-state-child-credit: phases out only at high income.
- me-dependent-exemption-tax-credit: phases out only at high income.
- ma-child-family-tax-credit: no income limit in the text.
- vt-child-tax-credit: phases out at 125k to 175k, high income.
- treasury-trump-account-pilot-deposit: birth-date and SSN rule only.

## Ambiguous choices
- amerihealth-caritas-bright-start and molina-pregnancy-rewards: text never says Medicaid, so `member` only.
- my-health-pays-prenatal-rewards: Medicaid members of several different plans (no single insurer named), so `medicaid` only, insurer empty.
- anthem-future-moms: text says Medicaid versions have other names, so commercial; `member` only. ambetter: `member` only (Marketplace not stated).
- wellpoint and UPMC for You: text says Medicaid members, so `medicaid` + `member`.
- medicaid-chip-pregnancy-coverage: income-based enrolment info, tagged `low-income`.
- irs-hsa-fsa-breast-pump-lactation: needs an HSA, FSA or HRA; tagged `insured` (HSA needs a qualifying plan; `employer` also plausible).
- irs-child-dependent-care-credit-fsa: `worker` only (FSA part is optional).
- nj-child-tax-credit ($80k cap), nm-child-tax-credit, mn-child-tax-credit, or-kids-credit: tagged `low-income` because income limits are modest.
- or-bridge-project-multnomah: `low-income` only; the county is a residence rule, not a hidden partner area.
- ct-baby-bonds: birth covered by HUSKY, so `medicaid`.
- usda-wic: `low-income` (it is the enrolment itself, not `wic`).
- Likely programs tagged `local`: baby2baby-golden-state-start, reach-out-and-read-free-books, buybuy-baby-registry-welcome-bag.
