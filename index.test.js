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

  describe('buildAttachmentBlock', () => {
    const buildAttachmentBlock = action.__get__('buildAttachmentBlock');
    const defaults = { repo: { owner: 'a', repo: 'b' }, ref: 'refs/heads/master', sha: 'shashasha' };

    it('should create a Slack attachment', () => {
      const attachment = buildAttachmentBlock({ ...defaults }, {});

      assert.deepStrictEqual(attachment, {
        fallback: '[a/b] (master) undefined',
        mrkdwn_in: [ 'text' ],
        text: undefined,
        footer: '*<https://github.com/a/b|a/b>* (<https://github.com/a/b/tree/master|master>)',
        footer_icon: 'https://github.com/a.png',
      });
    });

    it('should create a Slack attachment with an author', () => {
      const attachment = buildAttachmentBlock({ ...defaults, actor: 'jdrydn', workflow: 'CI/CD' }, {});

      assert.deepStrictEqual(attachment, {
        fallback: '[a/b] (master) undefined',
        mrkdwn_in: [ 'text' ],
        author_name: 'jdrydn',
        author_icon: 'https://github.com/jdrydn.png',
        author_link: 'https://github.com/jdrydn',
        title: 'CI/CD (#shashas)',
        title_link: 'https://github.com/a/b/commit/shashasha/checks',
        text: undefined,
        footer: '*<https://github.com/a/b|a/b>* (<https://github.com/a/b/tree/master|master>)',
        footer_icon: 'https://github.com/a.png',
      });
    });

    it('should create a Slack attachment with a pull-request', () => {
      const attachment = buildAttachmentBlock({
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
      }, {});

      assert.deepStrictEqual(attachment, {
        fallback: '[a/b] (pr-ref) undefined',
        mrkdwn_in: [ 'text' ],
        text: undefined,
        footer: '*<https://github.com/a/b|a/b>* (<https://github.com/a/b/tree/pr-ref|pr-ref>)',
        footer_icon: 'https://github.com/a.png',
      });
    });

    it('should create a Slack attachment with a pull-request & author', () => {
      const attachment = buildAttachmentBlock({
        ...defaults,
        eventName: 'pull_request',
        actor: 'jdrydn',
        workflow: 'CI/CD',
        payload: {
          pull_request: {
            head: {
              ref: 'pr-ref',
              sha: 'pr-shashasha',
            },
          },
        },
      }, {});

      assert.deepStrictEqual(attachment, {
        fallback: '[a/b] (pr-ref) undefined',
        mrkdwn_in: [ 'text' ],
        author_name: 'jdrydn',
        author_icon: 'https://github.com/jdrydn.png',
        author_link: 'https://github.com/jdrydn',
        title: 'CI/CD (#pr-shas)',
        title_link: 'https://github.com/a/b/commit/pr-shashasha/checks',
        text: undefined,
        footer: '*<https://github.com/a/b|a/b>* (<https://github.com/a/b/tree/pr-ref|pr-ref>)',
        footer_icon: 'https://github.com/a.png',
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

  const buildAttachmentBlock = () => 'ATTACHMENT';

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

    const sendToSlack = (conn, context, args) => {
      assert.deepStrictEqual(conn, {
        botToken: null,
        webhookUrl: 'some-important-webhook-url',
      });
      assert.deepStrictEqual(args, {
        attachments: [ 'ATTACHMENT' ],
      });
      return {
        ts: 'some-message-id',
      };
    };

    await action.__with__({ core, buildAttachmentBlock, sendToSlack })(() => action());

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

    const sendToSlack = (conn, context, args) => {
      assert.deepStrictEqual(conn, {
        botToken: 'some-important-bot-token',
        webhookUrl: null,
      });
      assert.deepStrictEqual(args, {
        channel: 'some-important-channel-id',
        ts: 'some-previous-important-message-id',
        attachments: [ 'ATTACHMENT' ],
      });
      return {
        ts: 'some-message-id',
      };
    };

    await action.__with__({ core, buildAttachmentBlock, sendToSlack })(() => action());

    assert.strictEqual(core.getOutput('message-id'), 'some-message-id');
    assert.strictEqual(core.getFailed(), null);
  });

});
