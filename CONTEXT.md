# Domain Language & Context

This file serves as the definitive glossary for the ubiquitous language used in the Korrin's Photography codebase. All code, variables, and documentation should adhere to these definitions.

## Glossary

- **Booking Inquiry**: A lead or prospective client request submitted through the public booking form. It goes through a lifecycle (Kanban phases) before becoming a confirmed session.
- **Event**: A confirmed photography session and its associated client gallery. This is the core entity that links photos, clients, and scheduling.
- **Photo**: An individual image asset belonging to an Event, stored in Cloudflare R2 and delivered via Cloudflare Images.
- **Event Access**: The permission granting a specific User (client) access to view or download from a specific Event gallery.
- **Activity Feed**: An audit log of administrative actions (e.g., status changes, email sends) for dashboard visibility.
