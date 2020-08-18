const core = require('@actions/core')
const github = require('@actions/github')

async function run() {
  try {
    const GITHUB_TOKEN = core.getInput('REPO_TOKEN')

    const octokit = github.getOctokit(GITHUB_TOKEN)

    const { payload, sha } = github.context

    const baseObject = {
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
    }

    const match = payload.pull_request.body.match(/(@vas-build) (?<path>[\/]{1}.*\/?)((?:\\n)|)/i)
    let path

    if (match) {
      path = match.groups.path
    }

    const baseComment = `Deploy preview ready! :rocket:\n\nBuilt with commit ${
      payload.pull_request.head.sha
    }\n\nhttps://platform-${payload.number}.vas-test.com${path || ''}`

    if (payload.action === 'opened') {
      // No comments exist yet. Post a new comment
      await octokit.issues.createComment({
        ...baseObject,
        issue_number: payload.number,
        body: baseComment,
      })
    } else if (payload.action === 'synchronize') {
      // Comment _should_ exist, look it up and update it
      const currentIssueComments = await octokit.issues.listComments({
        ...baseObject,
        issue_number: payload.number,
      })

      const botComment = currentIssueComments.data.find((issue) => issue.user.login === 'vas-build')

      if (botComment) {
        await octokit.issues.updateComment({
          ...baseObject,
          comment_id: botComment.id,
          body: baseComment,
        })
      } else {
        // Just in case there is no comment, create a new one
        await octokit.issues.createComment({
          ...baseObject,
          issue_number: payload.number,
          body: baseComment,
        })
      }
    }

    await octokit.repos.createCommitStatus({
      ...baseObject,
      sha: payload.pull_request.head.sha,
      context: 'Live Preview',
      state: 'success',
      description: 'PR is ready for preview',
      target_url: `https://platform-${payload.number}.vas-test.com`,
    })
  } catch (error) {
    core.setFailed(error.message)
  }
}

module.exports = run
