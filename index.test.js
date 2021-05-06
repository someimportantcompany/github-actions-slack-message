const assert = require('assert');
const nock = require('nock');
const rewire = require('rewire');

describe('@someimportantcompany/github-actions-slack-notify', () => {
  const action = rewire('./index');
  const env = {
    GITHUB_EVENT_NAME: 'push',
    GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_API_URL: 'https://api.github.com',
    GITHUB_GRAPHQL_URL: 'https://api.github.com/graphql',
    GITHUB_WORKFLOW: 'CI/CD',
    GITHUB_RUN_ID: '1234',
    GITHUB_RUN_NUMBER: '1',
    GITHUB_JOB: 'abcd1234',
    GITHUB_ACTION: 'a1b2c3d4',
    GITHUB_ACTIONS: '',
    GITHUB_ACTOR: 'jdrydn',
    GITHUB_REPOSITORY: 'jdrydn/github-actions-slack-message',
    GITHUB_REF: 'refs/heads/master',
    GITHUB_SHA: 'shashasha',
    GITHUB_HEAD_REF: '',
  };

  before(() => Object.assign(process.env, env));

  describe('buildAttachmentBlock', () => {
    const buildAttachmentBlock = action.__get__('buildAttachmentBlock');
    beforeEach(() => Object.assign(process.env, env));
    after(() => Object.assign(process.env, env));

    it('should create a Slack attachment', () => {
      Object.assign(process.env, {
        ...env,
        GITHUB_WORKFLOW: '',
        GITHUB_RUN_ID: '',
        GITHUB_ACTOR: '',
        GITHUB_REPOSITORY: 'a/b',
        GITHUB_REF: 'refs/heads/develop',
      });

      const attachment = buildAttachmentBlock({ color: '#4453A6' });

      assert.deepStrictEqual(attachment, {
        color: '#4453A6',
        fallback: '[a/b] (develop) undefined',
        mrkdwn_in: [ 'text' ],
        text: undefined,
        footer: '*<https://github.com/a/b|a/b>* (<https://github.com/a/b/tree/develop|develop>)',
      });
    });

    it('should create a Slack attachment with an author', () => {
      const attachment = buildAttachmentBlock({ color: 'danger', text: 'Hello, world!' });

      assert.deepStrictEqual(attachment, {
        color: 'danger',
        fallback: '[jdrydn/github-actions-slack-message] (master) Hello, world!',
        mrkdwn_in: [ 'text' ],
        author_name: 'jdrydn',
        author_icon: 'https://github.com/jdrydn.png',
        author_link: 'https://github.com/jdrydn',
        title: 'CI/CD (#shashash)',
        title_link: 'https://github.com/jdrydn/github-actions-slack-message/actions/runs/1234',
        text: 'Hello, world!',
        footer: '*<https://github.com/jdrydn/github-actions-slack-message|jdrydn/github-actions-slack-message>* (<https://github.com/jdrydn/github-actions-slack-message/tree/master|master>)',
      });
    });

    it('should create a Slack attachment with a pull-request', () => {
      Object.assign(process.env, {
        ...env,
        GITHUB_EVENT_NAME: 'pull_request',
        GITHUB_HEAD_REF: 'refs/heads/hotfix/quick-fix',
        GITHUB_ACTOR: '',
      });

      const attachment = buildAttachmentBlock({});

      assert.deepStrictEqual(attachment, {
        fallback: '[jdrydn/github-actions-slack-message] (hotfix/quick-fix) undefined',
        mrkdwn_in: [ 'text' ],
        title: 'CI/CD (#shashash)',
        title_link: 'https://github.com/jdrydn/github-actions-slack-message/actions/runs/1234',
        text: undefined,
        footer: '*<https://github.com/jdrydn/github-actions-slack-message|jdrydn/github-actions-slack-message>* (<https://github.com/jdrydn/github-actions-slack-message/tree/hotfix/quick-fix|hotfix/quick-fix>)',
      });
    });

    it('should create a Slack attachment with a pull-request & author', () => {
      Object.assign(process.env, {
        ...env,
        GITHUB_EVENT_NAME: 'pull_request',
        GITHUB_HEAD_REF: 'refs/heads/hotfix/quick-fix',
      });

      const attachment = buildAttachmentBlock({});

      assert.deepStrictEqual(attachment, {
        fallback: '[jdrydn/github-actions-slack-message] (hotfix/quick-fix) undefined',
        mrkdwn_in: [ 'text' ],
        title: 'CI/CD (#shashash)',
        title_link: 'https://github.com/jdrydn/github-actions-slack-message/actions/runs/1234',
        author_icon: 'https://github.com/jdrydn.png',
        author_link: 'https://github.com/jdrydn',
        author_name: 'jdrydn',
        text: undefined,
        footer: '*<https://github.com/jdrydn/github-actions-slack-message|jdrydn/github-actions-slack-message>* (<https://github.com/jdrydn/github-actions-slack-message/tree/hotfix/quick-fix|hotfix/quick-fix>)',
      });
    });
  });

  describe('sendToSlack', () => {
    const sendToSlack = action.__get__('sendToSlack');
    before(() => Object.assign(process.env, env));
    afterEach(() => nock.cleanAll());

    it('should send a message with a bot token', async () => {
      const scope = nock('https://slack.com', {
          reqheaders: {
            authorization: 'Bearer some-important-bot-token',
            'user-agent': 'jdrydn/github-actions-slack-message (via someimportantcompany/github-actions-slack-notify)',
          },
        })
        .post('/api/chat.postMessage', { text: 'c' })
        .reply(200, { ok: true });

      await sendToSlack({ botToken: 'some-important-bot-token' }, { text: 'c' });

      scope.done();
    });

    it('should handle errors returned from Slack', async () => {
      const scope = nock('https://slack.com', {
          reqheaders: {
            authorization: 'Bearer some-important-bot-token',
            'user-agent': 'jdrydn/github-actions-slack-message (via someimportantcompany/github-actions-slack-notify)',
          },
        })
        .post('/api/chat.postMessage', { text: 'c' })
        .reply(400, { ok: false, error: 'not-the-droids-you-are-looking-for' });

      try {
        await sendToSlack({ botToken: 'Bearer some-important-bot-token' }, { text: 'c' });
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.strictEqual(err.message, 'Error from Slack: not-the-droids-you-are-looking-for');
      }

      scope.done();
    });

    it('should send a message to a webhook URL', async () => {
      const scope = nock('https://some-important-webhook', {
          reqheaders: {
            'user-agent': 'jdrydn/github-actions-slack-message (via someimportantcompany/github-actions-slack-notify)',
          },
        })
        .post('/', { text: 'c' })
        .reply(200, 'ok');

      await sendToSlack({ webhookUrl: 'https://some-important-webhook' }, { text: 'c' });

      scope.done();
    });

    it('should send an update with a bot token', async () => {
      const scope = nock('https://slack.com', {
          reqheaders: {
            authorization: 'Bearer some-important-bot-token',
            'user-agent': 'jdrydn/github-actions-slack-message (via someimportantcompany/github-actions-slack-notify)',
          },
        })
        .post('/api/chat.update', { text: 'c', ts: 1620307308705 })
        .reply(200, { ok: true });

      await sendToSlack({ botToken: 'some-important-bot-token' }, { text: 'c', ts: 1620307308705 });

      scope.done();
    });

    it('should throw an error if no botToken/webhookUrl is present', async () => {
      try {
        await sendToSlack({}, {});
        assert.fail('Should have failed');
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.strictEqual(err.message, 'Missing botToken/webhookUrl');
      }
    });
  });

  const buildAttachmentBlock = () => 'ATTACHMENT';
  const mockCore = ({ inputs = {}, outputs = {} } = {}) => ({
    getInput: key => inputs[key] || null,
    getOutput: key => outputs[key] || null,
    setOutput: (key, value) => outputs[key] = value,
    getFailed: () => outputs.failed || null,
    setFailed: value => outputs.failed = value,
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

    const sendToSlack = (conn, args) => {
      assert.deepStrictEqual(conn, {
        botToken: null,
        webhookUrl: 'some-important-webhook-url',
      });
      assert.deepStrictEqual(args, {
        channel: 'some-important-channel-id',
        attachments: [ 'ATTACHMENT' ],
      });
      return {
        ts: 'some-message-id',
      };
    };

    await action.__with__({ core, buildAttachmentBlock, sendToSlack })(() => action());

    assert.strictEqual(core.getOutput('message-id'), null);
    assert.strictEqual(core.getFailed(), null);
  });

  it('should send a message to Slack with details', async () => {
    const core = mockCore({
      inputs: {
        'webhook-url': 'some-important-webhook-url',
        'text': 'Some important message',
        'username': 'git-bot',
        'icon-emoji': ':rocket:',
        'icon-url': 'https://github.com/someimportantcompany.png',
      },
    });

    const sendToSlack = (conn, args) => {
      assert.deepStrictEqual(conn, {
        botToken: null,
        webhookUrl: 'some-important-webhook-url',
      });
      assert.deepStrictEqual(args, {
        username: 'git-bot',
        icon_emoji: ':rocket:',
        icon_url: 'https://github.com/someimportantcompany.png',
        attachments: [ 'ATTACHMENT' ],
      });
      return {
        ts: 'some-message-id',
      };
    };

    await action.__with__({ core, buildAttachmentBlock, sendToSlack })(() => action());

    assert.strictEqual(core.getOutput('message-id'), null);
    assert.strictEqual(core.getFailed(), null);
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

    const sendToSlack = (conn, args) => {
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
