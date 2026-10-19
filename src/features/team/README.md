# Company and team

CompanySettings persists HR Admin company edits. TeamPage implements paginated members and invitations, controlled member edits, email requests, resend and cancellation. DepartmentsPage creates, edits and archives empty departments and assigns eligible managers. DepartmentPicker searches bounded choices.

All permissions are enforced by RLS and private checked RPCs. JoinPage activates only verified, pending invitation recipients. See docs/team-setup.md for flow, tests and live email acceptance.
