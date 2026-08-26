import { createServer, type RequestListener, type Server as HttpServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let modelServer: HttpServer | undefined;

  beforeEach(async () => {
    process.env.APP_DATA_DIR = mkdtempSync(join(tmpdir(), 'aissh-e2e-'));
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    if (modelServer) {
      await new Promise<void>((resolve) => modelServer?.close(() => resolve()));
    }
    modelServer = undefined;
    delete process.env.APP_DATA_DIR;
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/api/v1/configuration (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/configuration')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            folders: expect.any(Array),
            servers: expect.any(Array),
            commandTemplates: expect.any(Array),
            promptTree: expect.any(Array),
          }),
        );
      });
  });

  it('/api/v1/configuration (PUT) filters credentials', () => {
    return request(app.getHttpServer())
      .put('/api/v1/configuration')
      .send({
        servers: [{ id: 'e2e-server', name: 'E2E', ip: '127.0.0.1', username: 'root', port: 22, password: 'secret' }],
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.servers[0]).not.toHaveProperty('password');
        expect(body.servers[0].hasCredential).toBe(true);
      });
  });

  it('/api/v1/configuration/servers/:id/credential saves without returning password', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/configuration')
      .send({ servers: [{ id: 'credential-server', name: 'Credential', ip: '127.0.0.1', username: 'root', port: 22 }] })
      .expect(200);

    await request(app.getHttpServer())
      .put('/api/v1/configuration/servers/credential-server/credential')
      .send({ password: 'stored-password' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(expect.objectContaining({ id: 'credential-server', hasCredential: true }));
        expect(body).not.toHaveProperty('password');
      });
  });

  it('/api/v1/maintenance/backup (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/v1/maintenance/backup')
      .expect(201)
      .expect(({ body }) => {
        expect(body.path).toMatch(/backups\/aissh-.*\.sqlite$/);
      });
  });

  it('/api/v1/configuration/import (POST) creates a rollback backup before replacing data', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/configuration')
      .send({ servers: [{ id: 'before', name: 'Before', ip: '127.0.0.1', username: 'root', port: 22 }] })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/configuration/import')
      .send({ servers: [{ id: 'after', name: 'After', ip: '127.0.0.2', username: 'admin', port: 2222 }] })
      .expect(201)
      .expect(({ body }) => {
        expect(body.servers[0].id).toBe('after');
        expect(body.servers[0]).not.toHaveProperty('password');
      });

    expect((await request(app.getHttpServer()).get('/api/v1/configuration')).body.servers[0].id).toBe('after');
  });

  it('/api/v1/operation-logs supports create, filter, and scoped deletion', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/operation-logs')
      .send({ timestamp: '10:00:01', type: 'command', content: '$ uptime', serverId: 'server-1' })
      .expect(201)
      .expect(({ body }) => expect(body.id).toEqual(expect.any(String)));
    await request(app.getHttpServer())
      .post('/api/v1/operation-logs')
      .send({ timestamp: '10:00:02', type: 'info', content: 'ready', serverId: 'server-2' })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/v1/operation-logs?serverId=server-1&limit=10')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({ type: 'command', content: '$ uptime', serverId: 'server-1' }),
        ]);
      });

    await request(app.getHttpServer())
      .delete('/api/v1/operation-logs?serverId=server-1')
      .expect(200)
      .expect({ deleted: 1 });
    await request(app.getHttpServer())
      .get('/api/v1/operation-logs')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([expect.objectContaining({ serverId: 'server-2' })]);
      });
    await request(app.getHttpServer())
      .delete('/api/v1/operation-logs')
      .expect(200)
      .expect({ deleted: 1 });
  });

  it('/api/v1/operation-logs rejects invalid input', () => {
    return request(app.getHttpServer())
      .post('/api/v1/operation-logs')
      .send({ timestamp: '10:00:00', type: 'debug', content: 'invalid', serverId: 'server-1' })
      .expect(400);
  });

  it('/api/v1/ai/chat (POST) rejects requests without a persisted API key', () => {
    return request(app.getHttpServer())
      .post('/api/v1/ai/chat')
      .send({
        config: { baseUrl: 'https://example.com/v1', model: 'test-model' },
        messages: [{ role: 'user', content: 'hello' }],
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe('AI API key is not configured');
      });
  });

  it('/api/v1/ai/credential (PUT) persists the API key without returning it', async () => {
    return request(app.getHttpServer())
      .put('/api/v1/ai/credential')
      .send({ apiKey: 'test-key' })
      .expect(200)
      .expect({ configured: true });
  });

  it('/api/v1/ai/sessions persists session and message CRUD', async () => {
    const session = await request(app.getHttpServer())
      .post('/api/v1/ai/sessions')
      .send({ serverId: 'server-1', title: 'CPU 检查', mode: 'chat' })
      .expect(201)
      .then((response) => response.body);

    await request(app.getHttpServer())
      .get('/api/v1/ai/sessions?serverId=server-1')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({ id: session.id, title: 'CPU 检查', mode: 'chat' }),
        ]);
      });

    const message = await request(app.getHttpServer())
      .post(`/api/v1/ai/sessions/${session.id}/messages`)
      .send({ role: 'assistant', content: '' })
      .expect(201)
      .then((response) => response.body);

    await request(app.getHttpServer())
      .patch(`/api/v1/ai/sessions/${session.id}/messages/${message.id}`)
      .send({ content: 'CPU 负载正常' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(expect.objectContaining({ content: 'CPU 负载正常' }));
      });

    await request(app.getHttpServer())
      .delete(`/api/v1/ai/sessions/${session.id}/messages`)
      .expect(200)
      .expect({ deleted: 1 });
    await request(app.getHttpServer())
      .delete(`/api/v1/ai/sessions/${session.id}`)
      .expect(200)
      .expect({ deleted: true });
    await request(app.getHttpServer())
      .get(`/api/v1/ai/sessions/${session.id}/messages`)
      .expect(404);
  });

  it('/api/v1/ai/chat (POST) proxies a non-streaming model response', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/ai/credential')
      .send({ apiKey: 'test-key' })
      .expect(200);
    const baseUrl = await startModelServer((req, res) => {
      expect(req.headers.authorization).toBe('Bearer test-key');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: { content: 'model reply' } }] }));
    });

    return request(app.getHttpServer())
      .post('/api/v1/ai/chat')
      .send({
        config: { baseUrl, model: 'test-model' },
        messages: [{ role: 'user', content: 'hello' }],
      })
      .expect(200)
      .expect({ content: 'model reply' });
  });

  it('/api/v1/ai/chat (POST) never forwards persisted server passwords', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/ai/credential')
      .send({ apiKey: 'test-key' })
      .expect(200);
    await request(app.getHttpServer())
      .put('/api/v1/configuration')
      .send({ servers: [{ id: 'protected-server', name: 'Protected', ip: '127.0.0.1', username: 'root', port: 22, password: 'device-secret' }] })
      .expect(200);

    const baseUrl = await startModelServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        expect(body).not.toContain('device-secret');
        expect(body).toContain('[设备密码已隐藏]');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ choices: [{ message: { content: 'model reply' } }] }));
      });
    });

    return request(app.getHttpServer())
      .post('/api/v1/ai/chat')
      .send({
        config: { baseUrl, model: 'test-model' },
        messages: [{ role: 'user', content: '请检查 password=device-secret 和 device-secret' }],
      })
      .expect(200)
      .expect({ content: 'model reply' });
  });

  it('/api/v1/ai/chat (POST) includes a safe upstream error summary', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/ai/credential')
      .send({ apiKey: 'test-key' })
      .expect(200);
    const baseUrl = await startModelServer((_req, res) => {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { message: 'Service temporarily unavailable' } }));
    });

    return request(app.getHttpServer())
      .post('/api/v1/ai/chat')
      .send({
        config: { baseUrl, model: 'test-model' },
        messages: [{ role: 'user', content: 'hello' }],
      })
      .expect(502)
      .expect(({ body }) => {
        expect(body.message).toBe('AI model service returned 503: Service temporarily unavailable');
      });
  });

  it('/api/v1/ai/chat (POST) forwards a streaming model response', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/ai/credential')
      .send({ apiKey: 'test-key' })
      .expect(200);
    const baseUrl = await startModelServer((_req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.end('data: {"choices":[{"delta":{"content":"hello"}}]}\\n\\ndata: [DONE]\\n\\n');
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/chat')
      .send({
        config: { baseUrl, model: 'test-model' },
        messages: [{ role: 'user', content: 'hello' }],
        stream: true,
      })
      .expect(200);

    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.text).toContain('"hello"');
  });

  async function startModelServer(
    handler: RequestListener,
  ): Promise<string> {
    modelServer = createServer(handler);
    await new Promise<void>((resolve) => modelServer?.listen(0, '127.0.0.1', () => resolve()));
    const address = modelServer.address();
    if (!address || typeof address === 'string') throw new Error('model server did not start');
    return `http://127.0.0.1:${address.port}/v1`;
  }
});
