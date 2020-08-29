const assert = require('assert');
const nock = require('nock');
const rewire = require('rewire');

describe('@someimportantcompany/github-actions-slack-notify', () => {
  const action = rewire('./index');

  const mockCore = ({ inputs = {}, outputs = {} } = {}) => ({
    getInput: key => inputs[key] || null,
    getOutput: key => outputs[key] || null,
    setOutput: (key, value) => outputs[key] = value,
    getFailed: () => outputs.failed || null,
    setFailed: value => outputs.failed = value,
  });

  before(() => {
    process.env.SHOW_DEBUG = false;
    process.env.THROW_ERR = true;
  });

  describe('buildContextBlock', () => {
    const buildContextBlock = action.__get__('buildContextBlock');
    const defaults = { repo: { owner: 'a', repo: 'b' }, ref: 'refs/heads/master', sha: 'shashasha' };

    it('should create a Slack context', () => {
      const context = buildContextBlock({ ...defaults });

      assert.deepStrictEqual(context, {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: '*<https://github.com/a/b|a/b>* (<https://github.com/a/b/tree/master|master>) (<https://github.com/a/b/commit/shashasha|#shashas>)' },
        ],
      });
    });

    it('should create a Slack context with an author', () => {
      const context = buildContextBlock({ ...defaults, actor: 'jdrydn', workflow: 'CICD' });

      assert.deepStrictEqual(context, {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: '*Trigger* by *<https://github.com/jdrydn|jdrydn>* from *<https://github.com/a/b/commit/shashasha/checks|CICD>*' },
          { type: 'mrkdwn', text: '*<https://github.com/a/b|a/b>* (<https://github.com/a/b/tree/master|master>) (<https://github.com/a/b/commit/shashasha|#shashas>)' },
        ],
      });
    });

    it('should create a Slack context with a pull-request', () => {
      const context = buildContextBlock({
        ...defaults,
        eventName: 'pull_request',
        payload: {
          pull_request: {
            head: {
              ref: 'pr-ref',
              sha: 'pr-shashasha',
            },
          }
        }
      });

      assert.deepStrictEqual(context, {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: '*<https://github.com/a/b|a/b>* (<https://github.com/a/b/tree/pr-ref|pr-ref>) (<https://github.com/a/b/commit/pr-shashasha|#pr-shas>)' },
        ],
      });
    });

    it('should create a Slack context with a pull-request & author', () => {
      const context = buildContextBlock({
        ...defaults,
        eventName: 'pull_request',
        actor: 'jdrydn',
        workflow: 'CICD',
        payload: {
          pull_request: {
            head: {
              ref: 'pr-ref',
              sha: 'pr-shashasha',
            },
          }
        }
      });

      assert.deepStrictEqual(context, {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: '*Pull Request* by *<https://github.com/jdrydn|jdrydn>* from *<https://github.com/a/b/commit/pr-shashasha/checks|CICD>*' },
          { type: 'mrkdwn', text: '*<https://github.com/a/b|a/b>* (<https://github.com/a/b/tree/pr-ref|pr-ref>) (<https://github.com/a/b/commit/pr-shashasha|#pr-shas>)' },
        ],
      });
    });
  });

  describe('sendToSlack', () => {
    const sendToSlack = action.__get__('sendToSlack');
    const context = { repo: { owner: 'a', repo: 'b' } };

    afterEach(() => nock.cleanAll());

    it('should send a message with a bot token', async () => {
      const scope = nock('https://slack.com', {
          reqheaders: {
            authorization: 'Bearer some-important-bot-token',
            'user-agent': 'a/b (via @someimportantcompany/github-actions-slack-notify)',
          },
        })
        .post('/api/chat.postMessage', { text: 'c' })
        .reply(200, { ok: true });

      await sendToSlack({ botToken: 'some-important-bot-token' }, context, { text: 'c' });

      scope.done();
    });

    it('should handle errors returned from Slack', async () => {
      const scope = nock('https://slack.com', {
          reqheaders: {
            authorization: 'Bearer some-important-bot-token',
            'user-agent': 'a/b (via @someimportantcompany/github-actions-slack-notify)',
          },
        })
        .post('/api/chat.postMessage', { text: 'c' })
        .reply(400, { ok: false, error: 'not-the-droids-you-are-looking-for' });

      try {
        await sendToSlack({ botToken: 'Bearer some-important-bot-token' }, context, { text: 'c' });
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.strictEqual(err.message, 'Error from Slack: not-the-droids-you-are-looking-for');
      }

      scope.done();
    });

    it('should send a message to a webhook URL', async () => {
      const scope = nock('https://some-important-webhook', {
          reqheaders: {
            'user-agent': 'a/b (via @someimportantcompany/github-actions-slack-notify)',
          },
        })
        .post('/', { text: 'c' })
        .reply(200, 'ok');

      await sendToSlack({ webhookUrl: 'https://some-important-webhook' }, context, { text: 'c' });

      scope.done();
    });

    it('should throw an error if no botToken/webhookUrl is present', async () => {
      try {
        await sendToSlack({}, context, {});
        assert.fail('Should have failed');
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.strictEqual(err.message, 'Missing botToken/webhookUrl');
      }
    });
  });

  it('should send a message to Slack', async () => {
    const core = mockCore({
      inputs: {
        'channel': 'some-important-channel-id',
        'webhook-url': 'some-important-webhook-url',
        'text': 'Some important message',
        // 'color': '',
        // 'message-id': '',
      },
    });

    const buildContextBlock = () => ({ type: 'context' });

    const sendToSlack = (conn, context, args) => {
      assert.deepStrictEqual(conn, {
        botToken: null,
        webhookUrl: 'some-important-webhook-url',
      });
      assert.deepStrictEqual(args, {
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', verbatim: false, text: 'Some important message' } },
          buildContextBlock(),
        ],
      });
      return {
        ts: 'some-message-id',
      };
    };

    await action.__with__({ core, buildContextBlock, sendToSlack })(() => action());

    assert.strictEqual(core.getOutput('message-id'), null);
  });

  it('should an update message', async () => {
    const core = mockCore({
      inputs: {
        'channel': 'some-important-channel-id',
        'bot-token': 'some-important-bot-token',
        'text': 'Some important message',
        'color': 'good',
        'message-id': 'some-previous-important-message-id',
      },
    });

    const buildContextBlock = () => ({ type: 'context' });

    const sendToSlack = (conn, context, args) => {
      assert.deepStrictEqual(conn, {
        botToken: 'some-important-bot-token',
        webhookUrl: null,
      });
      assert.deepStrictEqual(args, {
        channel: 'some-important-channel-id',
        ts: 'some-previous-important-message-id',
        attachments: [
          {
            color: 'good',
            blocks: [
              { type: 'section', text: { type: 'mrkdwn', verbatim: false, text: 'Some important message' } },
              buildContextBlock(),
            ],
          },
        ],
      });
      return {
        ts: 'some-message-id',
      };
    };

    await action.__with__({ core, buildContextBlock, sendToSlack })(() => action());

    assert.strictEqual(core.getOutput('message-id'), 'some-message-id');
    assert.strictEqual(core.getFailed(), null);
  });

});
