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
    let errCode = 0;
    if (err) { 
      errCode = err.errno;
    }
    cb(errCode, stats);
  });
}

function open(entry, flags, cb) {
   fs.open(path.join(sourceDir, entry), flags, function(err, fd) {
    let errCode = 0;
    if (err) { 
      errCode = err.errno;
    }
    cb(errCode, fd);
   });
}

function create(entry, flags, cb) {
  fs.open(path.join(sourceDir, entry), 'w+', function(err, fd) {
    cb(fd);
  });
}

function truncate(entry, len, cb) {
  fs.truncate(path.join(sourceDir, entry), len, function(err) {
    if (err) console.error('truncate', err);
    cb();
  });
}

function mkdir(entry, mode, cb) {
  fs.mkdir(path.join(sourceDir, entry), mode, function(err) {
    let errCode = 0;
    if (err) { 
      errCode = err.errno;
    }
    cb(errCode);
  })
}

function chmod(entry, mode, cb) {
  fs.chmod(path.join(sourceDir, entry), mode, function(err) {
    if (err) console.error('chmod', err);
    cb();
  })
}

function rmdir(entry, cb) {
  fs.rmdir(path.join(sourceDir, entry), function(err) {
    let errCode = 0;
    if (err) { 
      errCode = err.errno;
    }
    cb(errCode);
  });
}

function unlink(entry, cb) {
  fs.unlink(path.join(sourceDir, entry), function(err) {
    if (err) console.error('unlink', err);
    cb();
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
      getAttr(entry, function(errCode, stats) {
        if (errCode) {
          cb(errCode);
          return;
        }
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
      if (debug) console.log('open(%s, %d)', entry, flags);
      open(entry, flags, function(errCode, fd) {
        cb(errCode, fd);
      });
    },
    read: function (entry, fd, buf, len, pos, cb) {
      if (debug) console.log('read(%s, %d, %d, %d)', entry, fd, len, pos)
      fs.read(fd, buf, 0, len, pos, function(err, bytesRead, buffer) {
        if (err) console.error('read', err);
        return cb(buffer.length);
      });
    },
    create: function (entry, flags, cb) {
      if (debug) console.log('create(%s, %d)', entry, flags);
      create(entry, flags, function(fd) {
        cb(0, fd);
      });
    },
    truncate: function (entry, size, cb) {
      if (debug) console.log('truncate(%s, %d)', entry, size);
      truncate(entry, function() {
        cb(0);
      });
    },
    write: function (entry, fd, buf, len, pos, cb) {
      if (debug) console.log('write(%s, %d, %d, %d)', entry, fd, len, pos);
      fs.write(fd, buf, 0, len, pos, function(err, bytesWritten, buffer) {
        if (err) console.error('write', err);
        return cb(buffer.length);
      });
    },
    release: function (entry, fd, cb) {
      fs.close(fd, function() {
        cb(0);
      });
    },
    mkdir: function(entry, mode, cb) {
      if (debug) console.log('mkdir(%s, %d)', entry, mode);
      mkdir(entry, mode, function() {
        cb(0);
      })
    },
    rmdir: function(entry, cb) {
      if (debug) console.log('rmdir(%s)', entry);
      rmdir(entry, function(errCode) {
        cb(errCode);
      });
    },
    unlink: function(entry, cb) {
      if (debug) console.log('unlink(%s)', entry);
      unlink(entry, function() {
        cb(0);
      })
    },
    chmod: function(entry, mode, cb) {
      if (debug) console.log('chmod(%s, %d)', entry, mode);
      chmod(entry, mode, function() {
        cb(0);
      })
    },
  });

  process.on('SIGINT', function () {
    fuse.unmount('./mnt', function (err) {
      if (err) throw err;

      process.exit();
    })
  });
});