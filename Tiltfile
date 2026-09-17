# ==================================================================
# Dashboard Worktree Tiltfile - AUTO-DETECT
# ==================================================================
#
# Denna fil fungerar automagiskt i alla worktrees!
# Kopiera till alla nya worktrees - ingen konfiguration behövs.
#
# Användning:
#   cd /home/simon/repos/dashboard__worktrees/<worktree-name>
#   tilt up
#
# ==================================================================

import os

# AUTO-DETECT worktree-namn från nuvarande sökväg
cwd = os.getcwd()
worktree_name = os.path.basename(cwd)
worktree_path = cwd

print('==========================================')
print('Dashboard Development Environment')
print('Worktree: ' + worktree_name)
print('Path: ' + worktree_path)
print('==========================================')

local_resource(
    'dev',
    serve_cmd='cd ' + worktree_path + ' && nub run dev --port 0',
    serve_dir=worktree_path + '/src/nuxt',
    labels=['Frontend'],
    auto_init=False,
)
