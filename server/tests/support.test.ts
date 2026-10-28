import { beforeEach, describe, expect, it } from 'vitest';
import { createRoute, prisma, resetDatabase, signedIn } from './helpers';

beforeEach(resetDatabase);

const complaint = {
  subject: 'Alert did not ring',
  description: 'My phone did not ring before the stop yesterday evening.',
  category: 'COMPLAINT',
};

describe('passenger support requests', () => {
  it('submits a request and only ever sees their own', async () => {
    const { client: alice } = await signedIn('PASSENGER');
    const { client: bob } = await signedIn('PASSENGER');

    const created = await alice.post('/api/support/tickets', complaint);
    expect(created.status).toBe(201);
    expect(created.body.ticket).toMatchObject({ status: 'OPEN', category: 'COMPLAINT', priority: 'HIGH' });
    const id = created.body.ticket.id;
    await bob.post('/api/support/tickets', { ...complaint, subject: "Bob's issue" });

    const aliceList = await alice.get('/api/support/tickets');
    expect(aliceList.body.tickets.map((t: { id: number }) => t.id)).toEqual([id]);
    expect((await bob.get(`/api/support/tickets/${id}`)).status).toBe(404);
    expect((await bob.post(`/api/support/tickets/${id}/responses`, { message: 'hi' })).status).toBe(404);
  });

  it('validates the form', async () => {
    const { client } = await signedIn('PASSENGER');
    const res = await client.post('/api/support/tickets', { subject: 'x', description: 'short', category: 'ANGRY' });
    expect(res.status).toBe(400);
    const paths = res.body.error.issues.map((i: { path: string }) => i.path);
    expect(paths).toEqual(expect.arrayContaining(['subject', 'description', 'category']));
  });

  it('can link a request to one of their own journeys only', async () => {
    const { route, stops } = await createRoute();
    const { client: alice } = await signedIn('PASSENGER');
    const journeyId = (await alice.post('/api/journeys', { routeId: route.id, destinationStopId: stops[2].id })).body.journey.id;
    const linked = await alice.post('/api/support/tickets', { ...complaint, journeyId });
    expect(linked.status).toBe(201);
    expect(linked.body.ticket.route.id).toBe(route.id);

    const { client: bob } = await signedIn('PASSENGER');
    expect((await bob.post('/api/support/tickets', { ...complaint, journeyId })).status).toBe(400);
  });

  it('cannot change status, escalate or read passenger history', async () => {
    const { client } = await signedIn('PASSENGER');
    const id = (await client.post('/api/support/tickets', complaint)).body.ticket.id;
    expect((await client.patch(`/api/support/tickets/${id}`, { status: 'RESOLVED' })).status).toBe(403);
    expect((await client.post(`/api/support/tickets/${id}/escalate`, { reason: 'Please look' })).status).toBe(403);
    expect((await client.get(`/api/support/tickets/${id}/passenger-journeys`)).status).toBe(403);
  });
});

describe('support agent workflow', () => {
  it('replies, keeps internal notes private and resolves the request', async () => {
    const { client: passenger, user: passengerUser } = await signedIn('PASSENGER');
    const { client: agent, user: agentUser } = await signedIn('SUPPORT');
    const id = (await passenger.post('/api/support/tickets', complaint)).body.ticket.id;

    const queue = await agent.get('/api/support/tickets?status=OPEN');
    expect(queue.body.tickets.map((t: { id: number }) => t.id)).toContain(id);

    const reply = await agent.post(`/api/support/tickets/${id}/responses`, { message: 'Sorry about that — checking now.' });
    expect(reply.status).toBe(201);
    expect(reply.body.ticket.status).toBe('IN_PROGRESS');
    expect(reply.body.ticket.assignedTo.id).toBe(agentUser.id);

    await agent.post(`/api/support/tickets/${id}/responses`, { message: 'GPS log shows weak signal.', internal: true });

    const seenByPassenger = await passenger.get(`/api/support/tickets/${id}`);
    const messages = seenByPassenger.body.ticket.responses.map((r: { message: string }) => r.message);
    expect(messages).toContain('Sorry about that — checking now.');
    expect(messages).not.toContain('GPS log shows weak signal.');
    expect(seenByPassenger.body.ticket.responses.every((r: { isInternal: boolean }) => !r.isInternal)).toBe(true);

    const seenByAgent = await agent.get(`/api/support/tickets/${id}`);
    expect(seenByAgent.body.ticket.responses).toHaveLength(2);

    const resolved = await agent.patch(`/api/support/tickets/${id}`, { status: 'RESOLVED', note: 'Explained settings' });
    expect(resolved.body.ticket.status).toBe('RESOLVED');
    expect(resolved.body.ticket.resolvedAt).not.toBeNull();

    // The passenger was notified of the reply and the status change.
    const notes = await prisma.notification.findMany({ where: { userId: passengerUser.id } });
    expect(notes.map((n) => n.type)).toEqual(expect.arrayContaining(['ticket.reply', 'ticket.status']));

    // Every action is on the ticket's timeline.
    const timeline = seenByAgent.body.ticket.events.map((e: { type: string }) => e.type);
    expect(timeline).toEqual(expect.arrayContaining(['CREATED', 'RESPONSE_ADDED', 'STATUS_CHANGED', 'INTERNAL_NOTE']));
  });

  it('a passenger reply re-opens a resolved request', async () => {
    const { client: passenger } = await signedIn('PASSENGER');
    const { client: agent } = await signedIn('SUPPORT');
    const id = (await passenger.post('/api/support/tickets', complaint)).body.ticket.id;
    await agent.patch(`/api/support/tickets/${id}`, { status: 'RESOLVED' });
    const res = await passenger.post(`/api/support/tickets/${id}/responses`, { message: 'Still happening today.' });
    expect(res.body.ticket.status).toBe('OPEN');
  });

  it('escalates to administrators exactly once and notifies them', async () => {
    const { client: passenger } = await signedIn('PASSENGER');
    const { client: agent } = await signedIn('SUPPORT');
    const { user: admin } = await signedIn('ADMIN');
    const id = (await passenger.post('/api/support/tickets', complaint)).body.ticket.id;

    const res = await agent.post(`/api/support/tickets/${id}/escalate`, { reason: 'Stop coordinates look wrong' });
    expect(res.status).toBe(200);
    expect(res.body.ticket).toMatchObject({ escalated: true, status: 'IN_PROGRESS', escalationReason: 'Stop coordinates look wrong' });
    expect((await agent.post(`/api/support/tickets/${id}/escalate`, { reason: 'Again please' })).status).toBe(409);

    const notifications = await prisma.notification.findMany({ where: { userId: admin.id } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ type: 'ticket.escalated', link: `/desk/tickets/${id}` });

    // The escalation reason is internal.
    const passengerView = await passenger.get(`/api/support/tickets/${id}`);
    expect(passengerView.body.ticket.escalationReason).toBeUndefined();
  });

  it("shows the complaining passenger's journey history to support staff", async () => {
    const { route, stops } = await createRoute();
    const { client: passenger } = await signedIn('PASSENGER');
    await passenger.post('/api/journeys', { routeId: route.id, destinationStopId: stops[1].id });
    const id = (await passenger.post('/api/support/tickets', complaint)).body.ticket.id;

    const { client: agent } = await signedIn('SUPPORT');
    const res = await agent.get(`/api/support/tickets/${id}/passenger-journeys`);
    expect(res.status).toBe(200);
    expect(res.body.journeys).toHaveLength(1);
    expect(res.body.journeys[0].destinationName).toBe(stops[1].name);
  });

  it('only assigns requests to support staff', async () => {
    const { client: passenger, user: passengerUser } = await signedIn('PASSENGER');
    const { client: agent, user: agentUser } = await signedIn('SUPPORT');
    const id = (await passenger.post('/api/support/tickets', complaint)).body.ticket.id;
    expect((await agent.patch(`/api/support/tickets/${id}`, { assignedToId: passengerUser.id })).status).toBe(400);
    const ok = await agent.patch(`/api/support/tickets/${id}`, { assignedToId: agentUser.id, priority: 'URGENT' });
    expect(ok.body.ticket).toMatchObject({ priority: 'URGENT', assignedTo: { id: agentUser.id } });
  });

  it('reports resolved cases for a period', async () => {
    const { client: passenger } = await signedIn('PASSENGER');
    const { client: agent } = await signedIn('SUPPORT');
    for (let i = 0; i < 3; i++) {
      const id = (await passenger.post('/api/support/tickets', { ...complaint, subject: `Issue number ${i}` })).body.ticket.id;
      if (i < 2) await agent.patch(`/api/support/tickets/${id}`, { status: 'RESOLVED' });
    }
    const res = await agent.get('/api/support/reports/resolved');
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({ opened: 3, resolved: 2 });
    expect(res.body.tickets).toHaveLength(2);
    expect((await agent.get('/api/support/reports/resolved?from=2026-02-10&to=2026-01-01')).status).toBe(400);
  });
});
