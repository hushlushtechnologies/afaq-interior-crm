# Afaq Al Manzel Interiors CRM — Logical Entity Relationships

Document version: 0.1
Phase: 0
Sprint: 02
Status: Logical design draft

## 1. Purpose

Describe domain relationships before the detailed table dictionary.

An entity represents a business concept.
A relationship explains how concepts connect.

This document does not create database tables.

The diagrams intentionally omit implementation details, many supporting
entities and unresolved cardinalities. They are not the final physical ERD.

## 2. Reading the diagrams

In Mermaid entity diagrams:
- || means exactly one.
- o{ means zero or many.
- |{ means one or many.

Example:

CLIENT ||--o{ PROJECT : has

Meaning:
One client may have zero or many projects.
Each project in this relationship belongs to one client.

## 3. Identity and project membership

```mermaid
erDiagram
    EMPLOYEE ||--o{ EMPLOYEE_ROLE : receives
    ROLE ||--o{ EMPLOYEE_ROLE : assigned_through
    ROLE ||--o{ ROLE_PERMISSION : grants
    PERMISSION ||--o{ ROLE_PERMISSION : included_in
    EMPLOYEE ||--o{ PROJECT_MEMBERSHIP : participates_through
    PROJECT ||--o{ PROJECT_MEMBERSHIP : includes