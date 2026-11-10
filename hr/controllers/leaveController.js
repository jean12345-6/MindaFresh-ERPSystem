import { getWorkspaceData } from "../services/workspaceService.js";
import { createLeave, decideLeave } from "../services/leaveService.js";

export const leavesPage = async (req, res, next) => {
  try {
    const data = await getWorkspaceData(req.user);
    res.render("leaves", {
      title: "Leave requests",
      activeLeaves: true,
      ...data,
    });
  } catch (error) {
    next(error);
  }
};

export const storeLeave = async (req, res, next) => {
  try {
    await createLeave(req.body, req.user);
    req.flash("success_msg", "Leave request submitted.");
    res.redirect("/leaves");
  } catch (error) {
    next(error);
  }
};

export const updateLeave = async (req, res, next) => {
  try {
    await decideLeave(req.params.id, req.body.status, req.user);
    req.flash("success_msg", "Leave request " + req.body.status + ".");
    res.redirect("/leaves");
  } catch (error) {
    next(error);
  }
};
