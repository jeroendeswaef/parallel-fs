var fuse = require('fuse-bindings')
const fs = require('fs');
const path = require('path');

const debug = false;

var ArgumentParser = require('argparse').ArgumentParser;
var parser = new ArgumentParser({
    version: '1.0.0',
    addHelp: true,
    description: 'Maps a directory structure upon a parallel directory'
});
parser.addArgument(
    [ '-s', '--source-dir' ],
    {
        help: 'The source directory',
        required: true
    }
);
parser.addArgument(
    [ '-t', '--target-dir' ],
    {
        help: 'The target directory',
        required: true
    }
);

var args = parser.parseArgs();

const sourceDir = args.source_dir;
const targetDir = args.target_dir;

function getFileList(entry) {
  return fs.readdirSync(path.join(sourceDir, entry));
}

function getAttr(entry, cb) {
  fs.stat(path.join(sourceDir, entry), function(err, stats) {
    cb(stats);
  });
}

function open(entry, cb) {
   fs.open(path.join(sourceDir, entry), "r", function(error, fd) {
     cb(fd);
   });
}

// If previous run didn't clean up properly, do it now;
fuse.unmount(targetDir, function () {
  fuse.mount(targetDir, {
    readdir: function (entry, cb) {
      if (debug) console.log('readdir(%s)', entry);
      cb(0, getFileList(entry));
    },
    getattr: function (entry, cb) {
      if (debug) console.log('getattr(%s)', entry);
      getAttr(entry, function(stats) {
        if (stats) {
          cb(0, {
            mtime: stats.mtime,
            atime: stats.atime,
            ctime: stats.ctime,
            size: stats.size,
            mode: stats.mode,
            uid: stats.uid,
            gid: stats.gid
          });
        } else {
          cb(fuse.ENOENT);
        }
      });
    },
    open: function (entry, flags, cb) {
      if (debug) console.log('open(%s, %d)', entry, flags)
      open(entry, function(fd) {
        cb(0, fd);
      });
    },
    read: function (entry, fd, buf, len, pos, cb) {
      if (debug) console.log('read(%s, %d, %d, %d)', entry, fd, len, pos)
      fs.read(fd, buf, 0, len, pos, function(error, bytesRead, buffer) {
        return cb(buffer.length);
      });
    },
    release: function (entry, fd, cb) {
      fs.close(fd, function() {
        cb(0);
      });
    }
  });

  process.on('SIGINT', function () {
    fuse.unmount('./mnt', function (err) {
      if (err) throw err;

      process.exit();
    })
  });
});