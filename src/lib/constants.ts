export const handoverTypes = ["Annual Leave", "Sick Leave", "Maternity Leave", "Paternity Leave", "Long Term Leave", "Resignation"] as const;
export const handoverStatuses = ["Pending", "Draft", "Awaiting Review", "Changes Requested", "Approved", "Completed"] as const;
export const memberRoles = ["Employee", "Cover Person", "Manager", "HR/Admin"] as const;
export type HandoverType = (typeof handoverTypes)[number];
export type HandoverStatus = (typeof handoverStatuses)[number];
export type MemberRole = (typeof memberRoles)[number];
