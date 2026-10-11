import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { prisma } from '../src/db/prisma';

describe('SpotCheck Backend API Suite', () => {
  let managerToken: string;
  let inspectorToken: string;
  let techToken: string;
  let facilityId: string;
  let templateId: string;
  let createdIssueId: string;
  let issueVersion = 1;

  beforeAll(async () => {
    // 1. Login as Facility Manager
    const mgrRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'manager@spotcheck.io', password: 'Password123!' });
    expect(mgrRes.status).toBe(200);
    expect(mgrRes.body.success).toBe(true);
    managerToken = mgrRes.body.data.token;

    // 2. Login as Inspector
    const inspRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'inspector@spotcheck.io', password: 'Password123!' });
    expect(inspRes.status).toBe(200);
    inspectorToken = inspRes.body.data.token;

    // 3. Login as Technician
    const techRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'tech@spotcheck.io', password: 'Password123!' });
    expect(techRes.status).toBe(200);
    techToken = techRes.body.data.token;

    // Get seeded facility
    const facRes = await request(app)
      .get('/api/v1/facilities')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(facRes.status).toBe(200);
    expect(facRes.body.data.length).toBeGreaterThan(0);
    facilityId = facRes.body.data[0].id;

    // Get template
    const tmplRes = await request(app)
      .get('/api/v1/templates')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(tmplRes.status).toBe(200);
    expect(tmplRes.body.data.length).toBeGreaterThan(0);
    templateId = tmplRes.body.data[0].id;
  });

  describe('1. Authentication & Security', () => {
    it('returns 401 for invalid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'manager@spotcheck.io', password: 'WrongPassword!' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('returns current authenticated user details on /auth/me', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('manager@spotcheck.io');
      expect(res.body.data.role).toBe('FACILITY_MANAGER');
    });

    it('blocks access to protected endpoints without token', async () => {
      const res = await request(app).get('/api/v1/facilities');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('2. Role-Based Authorization', () => {
    it('allows Facility Manager to view audit logs', async () => {
      const res = await request(app)
        .get('/api/v1/audit')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('denies Inspector from viewing audit logs with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/audit')
        .set('Authorization', `Bearer ${inspectorToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('denies Technician from viewing audit logs with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/audit')
        .set('Authorization', `Bearer ${techToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });
  });

  describe('3. QR Checkpoint Resolution', () => {
    it('resolves valid checkpoint by QR token', async () => {
      const res = await request(app)
        .get('/api/v1/checkpoints/by-token/QR-SPOTCHECK-APEX-CHL01')
        .set('Authorization', `Bearer ${inspectorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.code).toBe('CHK-B1-CHL01');
      expect(res.body.data.facility).toBeDefined();
    });

    it('returns 404 for non-existent QR token', async () => {
      const res = await request(app)
        .get('/api/v1/checkpoints/by-token/QR-UNKNOWN-INVALID')
        .set('Authorization', `Bearer ${inspectorToken}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('CHECKPOINT_NOT_FOUND');
    });
  });

  describe('4. Work Order State Transitions & Enforcement', () => {
    it('creates a new work order in REPORTED state', async () => {
      const res = await request(app)
        .post('/api/v1/work-orders')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({
          facilityId,
          title: 'Damaged Roof Drain Strainer Basket',
          description: 'Leaves and sediment clogging primary 4-inch roof drain bowl.',
          category: 'PLUMBING',
          severity: 'HIGH',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('REPORTED');
      createdIssueId = res.body.data.id;
      issueVersion = res.body.data.version;
    });

    it('transitions REPORTED -> ASSIGNED', async () => {
      const users = await prisma.user.findMany({ where: { role: 'MAINTENANCE_TECHNICIAN' } });
      const techId = users[0].id;

      const res = await request(app)
        .post(`/api/v1/work-orders/${createdIssueId}/transition`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          targetStatus: 'ASSIGNED',
          assignedToId: techId,
          currentVersion: issueVersion,
          notes: 'Dispatched to technician for clearing.',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.issue.status).toBe('ASSIGNED');
      issueVersion = res.body.data.issue.version;
    });

    it('rejects invalid state skip (ASSIGNED -> VERIFIED) with 400 Bad Request', async () => {
      const res = await request(app)
        .post(`/api/v1/work-orders/${createdIssueId}/transition`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          targetStatus: 'VERIFIED',
          currentVersion: issueVersion,
          verificationNotes: 'Skipping work directly to verified!',
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ILLEGAL_TRANSITION');
    });

    it('transitions ASSIGNED -> IN_PROGRESS', async () => {
      const res = await request(app)
        .post(`/api/v1/work-orders/${createdIssueId}/transition`)
        .set('Authorization', `Bearer ${techToken}`)
        .send({
          targetStatus: 'IN_PROGRESS',
          currentVersion: issueVersion,
          notes: 'Ascended to roof catwalk; commencing strainer clearing.',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.issue.status).toBe('IN_PROGRESS');
      issueVersion = res.body.data.issue.version;
    });

    it('transitions IN_PROGRESS -> RESOLVED with required resolution notes', async () => {
      const res = await request(app)
        .post(`/api/v1/work-orders/${createdIssueId}/transition`)
        .set('Authorization', `Bearer ${techToken}`)
        .send({
          targetStatus: 'RESOLVED',
          currentVersion: issueVersion,
          resolutionNotes: 'Removed 15 lbs of sediment, cleared 4-inch drain pipe, tested gravity drainage with hose.',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.issue.status).toBe('RESOLVED');
      issueVersion = res.body.data.issue.version;
    });

    it('allows Manager to reject verification and return issue back to IN_PROGRESS', async () => {
      const res = await request(app)
        .post(`/api/v1/work-orders/${createdIssueId}/transition`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          targetStatus: 'IN_PROGRESS',
          currentVersion: issueVersion,
          notes: 'Debris still visible along secondary overflow scupper. Please re-clear.',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.issue.status).toBe('IN_PROGRESS');
      issueVersion = res.body.data.issue.version;
    });

    it('re-resolves and then passes final manager verification to VERIFIED terminal state', async () => {
      // Re-resolve
      const resolveRes = await request(app)
        .post(`/api/v1/work-orders/${createdIssueId}/transition`)
        .set('Authorization', `Bearer ${techToken}`)
        .send({
          targetStatus: 'RESOLVED',
          currentVersion: issueVersion,
          resolutionNotes: 'Cleared secondary scuppers as requested.',
        });
      expect(resolveRes.status).toBe(200);
      issueVersion = resolveRes.body.data.issue.version;

      // Verify
      const verifyRes = await request(app)
        .post(`/api/v1/work-orders/${createdIssueId}/transition`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          targetStatus: 'VERIFIED',
          currentVersion: issueVersion,
          verificationNotes: 'Inspected roof section. All scuppers and primary drains clear. Approved and closed.',
        });
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.issue.status).toBe('VERIFIED');
      expect(verifyRes.body.data.issue.verifiedAt).toBeDefined();
    });

    it('detects concurrency conflict when stale version is sent', async () => {
      const res = await request(app)
        .post(`/api/v1/work-orders/${createdIssueId}/transition`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          targetStatus: 'IN_PROGRESS',
          currentVersion: 1, // Stale version! Current version is > 5
          notes: 'Concurrent update attempt',
        });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONCURRENCY_CONFLICT');
    });
  });

  describe('5. Idempotent Sync & Conflict Detection', () => {
    it('applies an offline-created inspection via sync endpoint', async () => {
      const testInspectionId = crypto.randomUUID();
      const idempotencyKey = `IDEMP-TEST-SYNC-${crypto.randomUUID()}`;
      const operationId = crypto.randomUUID();

      const syncPayload = {
        operations: [
          {
            operationId,
            idempotencyKey,
            entityType: 'INSPECTION',
            action: 'CREATE',
            recordId: testInspectionId,
            baseVersion: 0,
            clientTimestamp: new Date().toISOString(),
            payload: {
              templateId,
              templateVersion: 1,
              facilityId,
              status: 'DRAFT',
              startedAt: new Date().toISOString(),
              summaryNotes: 'Created offline during basement walk',
              items: [],
            },
          },
        ],
      };

      const res = await request(app)
        .post('/api/v1/sync')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send(syncPayload);

      expect(res.status).toBe(200);
      expect(res.body.data.applied).toBe(1);

      // Replaying the EXACT same sync request should be recognized as ALREADY_PROCESSED (idempotent)
      const replayRes = await request(app)
        .post('/api/v1/sync')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send(syncPayload);

      expect(replayRes.status).toBe(200);
      expect(replayRes.body.data.alreadyProcessed).toBe(1);
    });

    it('rejects sync operations from deactivated users', async () => {
      const uniqueEmail = `deactivated-${Date.now()}@spotcheck.io`;
      // Temporarily deactivate a user
      const tempUser = await prisma.user.create({
        data: {
          email: uniqueEmail,
          passwordHash: 'dummy',
          fullName: 'Revoked Inspector',
          role: 'INSPECTOR',
          isActive: false, // Revoked!
        },
      });

      try {
        // Manually mint token for deactivated user
        const jwt = (await import('jsonwebtoken')).default;
        const { config } = await import('../src/config');
        const token = jwt.sign({ userId: tempUser.id, email: tempUser.email, role: tempUser.role }, config.jwtSecret);

        const res = await request(app)
          .post('/api/v1/sync')
          .set('Authorization', `Bearer ${token}`)
          .send({
            operations: [
              {
                operationId: crypto.randomUUID(),
                idempotencyKey: `IDEMP-REVOKED-${crypto.randomUUID()}`,
                entityType: 'INSPECTION',
                action: 'CREATE',
                recordId: crypto.randomUUID(),
                baseVersion: 0,
                clientTimestamp: new Date().toISOString(),
                payload: { facilityId, templateId },
              },
            ],
          });

        // Server-side active user check immediately intercepts
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('USER_REVOKED');
      } finally {
        await prisma.user.delete({ where: { id: tempUser.id } }).catch(() => {});
      }
    });
  });

  describe('6. Reports and Analytics', () => {
    it('returns aggregated analytics for dashboard', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.metrics).toBeDefined();
      expect(res.body.data.metrics.totalInspections).toBeGreaterThan(0);
      expect(res.body.data.issuesByCategory).toBeInstanceOf(Array);
    });

    it('exports inspections to CSV with correct headers', async () => {
      const res = await request(app)
        .get('/api/v1/reports/inspections/csv')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Inspection ID,Facility Code,Facility Name');
    });
  });
});
