import Discussion from "./discussion.ts";
import Media from "./media.ts";
import Post from "./post.ts";
import PostMedia from "./post_media.ts";
import User from "./user.ts";
import Member from "./member.ts";
import Role from "./role.ts";
import "./soul.ts";

Discussion.belongsTo(User);
Discussion.hasMany(Post);

Post.belongsTo(User);
Post.belongsTo(Discussion);
Post.belongsToMany(Media, {
    through: PostMedia,
    foreignKey: "postId",
    otherKey: "mediumId",
});

Media.belongsToMany(Post, {
    through: PostMedia,
    foreignKey: "mediumId",
    otherKey: "postId",
});

User.hasMany(Discussion);
User.hasMany(Post);
