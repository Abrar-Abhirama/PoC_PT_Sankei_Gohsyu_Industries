# PRD — Local QR Traceability System PoC

## 1. Overview

This Proof of Concept (PoC) aims to demonstrate a local, on-premise QR traceability system for monitoring the production and inspection process of manufactured products.

The system will run entirely within the local industrial network using an existing Industrial PC (IPC). No cloud server or external hosting is required.

The system consists of a React web application, a Node.js backend, a PostgreSQL database, and a C# IPC integration service that communicates with the PLC.

The PLC-to-IPC communication and PLC programming are handled by the PLC/integration team. The application team is responsible for the web application, REST API, database, business logic, and the API interface used by the IPC.

## 2. Objectives

The PoC should demonstrate that the system can:

- Manage production orders.
- Generate unique product serial numbers for QR marking.
- Receive machine events from the IPC.
- Store production and machine events in PostgreSQL.
- Monitor machine and production status through a web dashboard.
- Search and display complete product traceability.
- Communicate between the backend and the C# IPC using REST/JSON.
- Operate completely within the local network.
- Support simulated PLC events before integration with the actual PLC and Keyence hardware.

## 3. System Architecture

```text
                         LOCAL NETWORK

┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Operator PC                                            │
│       │                                                 │
│       │ HTTP                                            │
│       ▼                                                 │
│  ┌───────────────┐                                      │
│  │ React Web App │                                      │
│  └───────┬───────┘                                      │
│          │ REST API                                     │
│          ▼                                              │
│  ┌──────────────────┐                                   │
│  │ Node.js Backend  │                                   │
│  │ TypeScript       │                                   │
│  └────────┬─────────┘                                   │
│           │                                             │
│           ▼                                             │
│  ┌──────────────────┐                                   │
│  │ PostgreSQL       │                                   │
│  └──────────────────┘                                   │
│           ▲                                             │
│           │ REST / JSON                                  │
│           ▼                                             │
│  ┌───────────────────────┐                              │
│  │ C# IPC Integration    │                              │
│  │ Service               │                              │
│  └───────────┬───────────┘                              │
│              │                                          │
│              │ PLC Protocol                             │
│              ▼                                          │
│       ┌─────────────┐                                   │
│       │ KV-8000 PLC │                                   │
│       └──────┬──────┘                                   │
│              │                                          │
│       ┌──────┴───────┐                                  │
│       ▼              ▼                                  │
│   SR-1000          IV3                                  │
│   QR Reader       Vision                                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

The React frontend, Node.js backend, and PostgreSQL database will be containerized using Docker and deployed on the local Industrial PC.

The C# IPC integration service may run directly on the Industrial PC because it requires communication with the PLC.

## 4. Technology Stack

| Component | Technology |
|---|---|
| Frontend | React + TypeScript |
| Backend | Node.js + TypeScript |
| Backend Framework | Express.js |
| API | REST + JSON |
| Database | PostgreSQL |
| Containerization | Docker + Docker Compose |
| IPC Integration | C# |
| Deployment | Local / On-Premise |

## 5. Core Functional Requirements

### 5.1 Production Order Management

The system shall allow operators to create, start, stop, and monitor production orders.

A production order contains:

- Order ID
- Product Code
- Product Name
- Target Quantity
- Current Quantity
- Status
- Created At
- Updated At

Production statuses:

```text
PENDING
RUNNING
COMPLETED
CANCELLED
```

### 5.2 Product and Serial Number Management

Each manufactured product shall have a unique serial number that will be used as the QR code identifier.

Example:

```text
QR-20260907-000001
QR-20260907-000002
QR-20260907-000003
```

The backend is responsible for generating and managing unique serial numbers and associating them with the corresponding production order.

### 5.3 Machine Event Monitoring

The backend shall receive machine events from the C# IPC service.

Supported event types include:

```text
PRODUCT_DETECTED
PRINT_STARTED
PRINT_COMPLETED
PRINT_FAILED
QR_READ
QR_READ_FAILED
VISION_PASS
VISION_FAIL
PRODUCT_COMPLETED
MACHINE_STARTED
MACHINE_STOPPED
MACHINE_ERROR
EMERGENCY_STOP
```

Example IPC request:

```http
POST /api/v1/ipc/events
Content-Type: application/json
```

```json
{
  "machineId": "LINE-01",
  "eventType": "PRODUCT_DETECTED",
  "timestamp": "2026-09-07T09:20:00+07:00"
}
```

The backend shall validate the event, process the required business logic, and persist the event in PostgreSQL.

### 5.4 IPC Data Retrieval

The C# IPC service shall be able to retrieve production information from the backend.

Example:

```http
GET /api/v1/ipc/next-product
```

Response:

```json
{
  "productionOrderId": "PO-001",
  "productCode": "PRODUCT-A",
  "serialNumber": "QR-20260907-000123"
}
```

The IPC can then provide this information to the PLC and production equipment.

### 5.5 Traceability

The system shall maintain a complete history for each product.

Example:

```text
QR-20260907-000123

09:20:01  Product Detected
09:20:03  QR Marked
09:20:05  QR Read — PASS
09:20:06  Vision Inspection — PASS
09:20:07  Product Completed — PASS
```

The traceability record shall be searchable using the product serial number.

Example API:

```http
GET /api/v1/products/{serialNumber}/traceability
```

### 5.6 Dashboard

The React dashboard shall provide an overview of the production system, including:

- Current machine status.
- Current production order.
- Production progress.
- Target quantity.
- Produced quantity.
- PASS quantity.
- FAIL quantity.
- Recent machine events.
- Production history.
- Product traceability.

Example:

```text
┌──────────────────────────────────────┐
│ Production Dashboard                 │
├──────────────────────────────────────┤
│ Machine: LINE-01                     │
│ Status: RUNNING                      │
│                                      │
│ Order: PO-001                        │
│ Product: PRODUCT-A                   │
│                                      │
│ Target:   1000                       │
│ Produced:  735                       │
│ Passed:    720                       │
│ Failed:     15                       │
│                                      │
│ Progress: 73.5%                      │
└──────────────────────────────────────┘
```

## 6. End-to-End Production Flow

The expected production flow is:

```text
Operator creates production order
              ↓
Operator starts production
              ↓
PLC detects product
              ↓
C# IPC receives PLC event
              ↓
IPC sends PRODUCT_DETECTED to Backend
              ↓
Backend creates/assigns unique serial number
              ↓
IPC retrieves serial number from Backend
              ↓
IPC sends required information to PLC
              ↓
PLC triggers QR marking
              ↓
QR is marked on the product
              ↓
SR-1000 reads the QR
              ↓
IV3 performs visual inspection
              ↓
PLC determines PASS / FAIL
              ↓
C# IPC receives the result
              ↓
IPC sends result to Backend
              ↓
Backend stores traceability data
              ↓
Dashboard displays production status
```

## 7. API Responsibilities

The Backend owns the REST API.

The C# IPC service acts as a client of the Backend API.

### IPC → Backend

Used for:

- Machine events.
- Product detection.
- QR marking results.
- QR reader results.
- Vision inspection results.
- Machine status.
- Machine errors.
- Production results.

Example:

```http
POST /api/v1/ipc/events
```

### Backend → IPC

The IPC can retrieve:

- Production information.
- Product serial numbers.
- Product information.
- Machine configuration.
- Other data required during production.

Example:

```http
GET /api/v1/ipc/next-product
```

The actual communication between the C# IPC service and the PLC is outside the backend scope and is handled by the PLC/integration team.

## 8. API Endpoints

Initial API structure:

```text
/api/v1/production-orders
/api/v1/production-orders/:id
/api/v1/production/start
/api/v1/production/stop
/api/v1/production/current
/api/v1/production/history

/api/v1/ipc/events
/api/v1/ipc/next-product
/api/v1/ipc/inspection-result
/api/v1/ipc/status

/api/v1/products/:serialNumber
/api/v1/products/:serialNumber/traceability

/api/v1/machines
/api/v1/machines/:id
/api/v1/machines/:id/status
```

The exact API contract, request payloads, response payloads, event types, and error codes shall be agreed upon between the backend and PLC/integration teams before integration testing.

## 9. Database

The initial PostgreSQL schema should contain:

```text
production_orders
    ├── id
    ├── order_number
    ├── product_code
    ├── product_name
    ├── target_quantity
    ├── status
    ├── created_at
    └── updated_at

products
    ├── id
    ├── serial_number
    ├── production_order_id
    ├── machine_id
    ├── status
    ├── created_at
    └── completed_at

machine_events
    ├── id
    ├── machine_id
    ├── product_id
    ├── event_type
    ├── event_data
    └── timestamp

inspections
    ├── id
    ├── product_id
    ├── inspection_type
    ├── result
    ├── details
    └── timestamp

machines
    ├── id
    ├── machine_code
    ├── name
    ├── status
    └── last_seen_at
```

The schema may be adjusted during implementation based on the final PLC event structure and hardware requirements.

## 10. Docker Deployment

The application shall be packaged using Docker Compose.

```text
docker-compose.yml

services:
  frontend
  backend
  postgres
```

The C# IPC integration service can run directly on the Industrial PC.

Example deployment:

```text
Industrial PC
│
├── Docker
│   ├── React Frontend
│   ├── Node.js Backend
│   └── PostgreSQL
│
└── C# IPC Service
        │
        ▼
      KV-8000
```

The system must be usable without Internet access after deployment.

## 11. Development Simulation

Before the actual PLC is connected, a mock IPC or simulated event generator shall be used to test the backend.

Example:

```text
Mock IPC
    ↓
POST /api/v1/ipc/events
    ↓
Backend
    ↓
PostgreSQL
    ↓
React Dashboard
```

The simulator should be able to generate events such as:

```text
PRODUCT_DETECTED
PRINT_COMPLETED
QR_READ
VISION_PASS
VISION_FAIL
PRODUCT_COMPLETED
MACHINE_ERROR
```

This allows the frontend and backend to be developed independently from the PLC integration.

## 12. Responsibilities

### Backend / Application Team

Responsible for:

- React web application.
- Node.js backend.
- REST API.
- PostgreSQL database.
- Business logic.
- Production order management.
- Serial number management.
- Traceability.
- Dashboard.
- Docker configuration.
- Local application deployment.
- Mock IPC for backend testing.

### PLC / Integration Team

Responsible for:

- PLC programming.
- KV-8000 configuration.
- PLC ↔ IPC communication.
- C# IPC integration service.
- Machine control logic.
- PLC event generation.
- Keyence hardware integration.
- Communication between PLC and production equipment.

### Shared Responsibilities

Both teams are responsible for agreeing on:

- API contract.
- JSON data structures.
- Machine event definitions.
- Serial number flow.
- Error handling.
- Integration testing.
- End-to-end production flow.

## 13. Out of Scope

The following are not part of the backend PoC implementation:

- PLC programming.
- PLC ladder logic.
- PLC ↔ IPC protocol implementation.
- Direct communication with KV-8000 from the backend.
- Direct communication with SR-1000 from the backend.
- Direct communication with IV3 from the backend.
- QR marking hardware implementation.
- Cloud infrastructure.
- Production-grade authentication/authorization.

## 14. PoC Success Criteria

The PoC is considered successful when the following flow can be demonstrated locally:

```text
Create Production Order
        ↓
Start Production
        ↓
Simulate or receive PLC Product Detection
        ↓
IPC sends event to Backend
        ↓
Backend generates unique serial number
        ↓
IPC retrieves serial number
        ↓
Production/inspection events are received
        ↓
Backend stores all events in PostgreSQL
        ↓
Dashboard displays production status
        ↓
Operator searches a serial number
        ↓
Complete product traceability is displayed
```

The system must operate entirely on the local network and must not require a cloud server for the PoC.