const { Octokit } = require('@octokit/rest')
const MyOctokit = Octokit.plugin(require('octokit-create-pull-request'))

module.exports = () => {
  const octokit = new MyOctokit({
    auth: `token ${process.env.GITHUB_TOKEN}`,
    userAgent: 'octokit/rest.js v1.2.3',
  })

  return octokit
}
