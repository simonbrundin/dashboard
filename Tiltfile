# ==================================================================
# Dashboard Development Environment - AUTO-DETECT
# ==================================================================
#
# Denna fil fungerar automagiskt i alla worktrees!
#
# Användning:
#   cd /home/simon/repos/dashboard__worktrees/<worktree-name>
#   tilt up
#
# ==================================================================

# AUTO-DETECT worktree-namn från PATH
worktree_path = str(working_dir())
worktree_name = worktree_path.split("/")[-1]

print("==========================================")
print("Dashboard Development Environment")
print("Worktree: " + worktree_name)
print("Path: " + worktree_path)
print("==========================================")

local_resource(
    "dev",
    serve_cmd = "cd " + worktree_path + " && nub run dev --port 0",
    serve_dir = worktree_path + "/src/nuxt",
    labels = ["Frontend"],
    auto_init = False,
)
