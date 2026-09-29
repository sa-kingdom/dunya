import FlarumDiscussion from "./discussion.ts";
import FlarumPost from "./post.ts";
import FlarumTag from "./tag.ts";
import FlarumUser from "./user.ts";

FlarumDiscussion.belongsTo(FlarumUser, { foreignKey: "userId", as: "user" });
FlarumDiscussion.hasMany(FlarumPost, {
    foreignKey: "discussionId",
    as: "posts",
});
FlarumPost.belongsTo(FlarumUser, { foreignKey: "userId", as: "user" });
FlarumPost.belongsTo(FlarumDiscussion, {
    foreignKey: "discussionId",
    as: "discussion",
});
FlarumDiscussion.belongsToMany(FlarumTag, {
    through: "discussion_tag",
    foreignKey: "discussion_id",
    otherKey: "tag_id",
    timestamps: false,
    as: "tags",
});

export { FlarumDiscussion, FlarumPost, FlarumTag, FlarumUser };
