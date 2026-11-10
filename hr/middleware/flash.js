// Session-backed flash messages using the standard req.flash(type, message) API.
// Array.isArray avoids connect-flash's deprecated util.isArray call on recent Node.
export default function flash() {
  return (req, res, next) => {
    req.flash = function(type, message) {
      const messages = req.session.flash || (req.session.flash = {});
      if (arguments.length === 0) { req.session.flash = {}; return messages; }
      if (arguments.length === 1) { const result = messages[type] || []; delete messages[type]; return result; }
      const list = messages[type] || (messages[type] = []);
      list.push(...(Array.isArray(message) ? message : [message]));
      return list.length;
    };
    next();
  };
}
