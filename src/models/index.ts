import Discussion from "./discussion.ts";
import Media from "./media.ts";
import Post from "./post.ts";
import User from "./user.ts";

Discussion.belongsTo(User);
Discussion.hasMany(Post);

Post.belongsTo(User);
Post.belongsTo(Discussion);
Post.hasMany(Media);
Post.belongsToMany(Media, {
    through: "post_media",
});

Media.belongsToMany(Post, {
    through: "post_media",
});

User.hasMany(Discussion);
User.hasMany(Post);
