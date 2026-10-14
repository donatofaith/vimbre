# Vimbre architecture (scaffold)

## Application
Next.js App Router, React and TypeScript, Tailwind CSS. Light glassmorphism brand direction based on approved UI/UX reference.

## REST API
`GET /api/health` is implemented. `/api/handovers` returns HTTP 501 until authenticated Supabase queries, company isolation and role permissions are implemented. Never substitute real employee data with public mocks.

## Integrations planned
- Supabase PostgreSQL, Auth, Storage and RLS
- OpenAI API for suggestions (employees must review all generated fields)
- Brevo for transactional email
- Vercel for hosting

## Roles
Employee; Cover Person; Manager; HR/Admin. PRD states one role per user per company. Company IDs and row-level security will control data access.

## Handover workflow
Pending → Draft → Awaiting Review → Approved → Completed; manager may request changes and employee may resubmit. Handover cover person may view once assigned. Completed records are read-only.

## Scope boundary
Product is for leave and resignation handovers—not payroll, recruitment or website-building.

## Pending
Database schema/migrations, auth, RLS, AI and email endpoints, end-to-end workflow tests, pricing entitlement confirmation, design assets, and production deployment.
