# -*- coding: utf-8 -*-

from server_utils import *
import os.path, sys, math
try: import simplejson as json
except ImportError: import json

class PythonPlugin:
  def __init__(self, kind, obj):
    self.id   = obj['id'] if 'id' in obj else None 
    self.name = obj['id'] if 'id' in obj else kind
    self.kind = kind
    self.obj = obj

    assert kind in so_dict, "Invalid kind of plugin"
    self.Class = so_dict[kind]

    module_name, _ = os.path.splitext(self.obj["module"])
    print >> sys.stderr, "PYTHON MODULE", self.obj["module"]
    self.module = __import__(module_name, globals(), locals(), [], -1)
    assert self.module, "Invalid python module '%s'" % self.obj["module"]

    import shlex
    params = shlex.split(self.obj["parameters"]) if "parameters" in self.obj else None
    if "name" in self.obj:
      self.plugin = self.module.__dict__[self.obj["name"]](params)
    else:
      self.plugin = self.module.__dict__["Plugin"](params)

  def new_instance(self, specialization_id = None):
    return self.plugin 

  def del_instance(self, inst):
    pass

  def reset(self):
    pass

  def __del__(self):
    del self.plugin



so_dict = {
  "mt": MtPlugin,
  "imt": ImtPlugin,
  "aligner": AlignmentPlugin,
  "confidencer": ConfidencePlugin,
  "word-prioritizer": WordPriorityPlugin,
  "source-processor": TextProcessorPlugin,
  "target-processor": TextProcessorPlugin,
}

class SoPlugin:
  def __init__(self, kind, obj):
    self.id   = obj['id'] if 'id' in obj else None 
    self.name = obj['id'] if 'id' in obj else kind
    self.kind = kind
    self.obj = obj

    assert kind in so_dict, "Invalid kind of plugin"
    self.Class = so_dict[kind]

    if "name" in obj:
      self.plugin = self.Class(self.obj["module"], self.obj["parameters"], self.obj["name"])
    else:
      self.plugin = self.Class(self.obj["module"], self.obj["parameters"])
    if not self.plugin:
      raise Exception("%s plugin failed" % self.kind)

    self.factory = self.plugin.create()
    if not self.factory: 
      raise Exception("%s plugin failed" % self.kind)
    if logger:
      self.factory.setLogger(logger)

    self.avoid_updates = False
    if "avoid-updates" in self.obj and self.obj["avoid-updates"]:
      self.avoid_updates = True

    self.instances = []

  def new_instance(self, specialization_id = ""):
    instance = self.factory.createInstance(specialization_id)
    if not instance: 
      raise Exception("%s instance failed" % self.kind)
    self.instances.append(instance)
    return instance

  def del_instance(self, inst):
    self.instances.remove(inst)
    self.factory.deleteInstance(inst);

  def reset(self):
    print "reseting", self.kind
    old = self.instances[:]
    self.instances = []
    for instance in old:
      self.factory.deleteInstance(instance);
      self.new_instance()

  def __del__(self):
    for inst in self.instances[:]:
      print "Deleting", inst
      self.del_instance(inst);
    self.plugin.destroy(self.factory)
    del self.plugin

class RefPlugin:
  def __init__(self, kind, obj, ref):
    self.id   = obj['id'] if 'id' in obj else None 
    self.name = obj['id'] if 'id' in obj else kind

    self.kind = kind
    self.obj = obj
    self.ref = ref


def get_objects(config, kind):
  if kind not in config: return []
  return config[kind] if type(config[kind]) is list else [config[kind]]



class Models:
  def __init__(self, config_fn):
    self.systems = {}
    self.plugins = {}
    self.refs = {}
    self.updates = []
    self.config = json.load(open(config_fn))
    print >> sys.stderr, "config", json.dumps(self.config)

  def __getattr__(self, name):
    name = name.replace('_', '-')
    if name in self.systems:
      system = self.systems[name][0][1]
      return system
    else:
      raise AttributeError("No model '%s' found" % name)

  def get_system(self, kind, name):
    if kind in self.systems:
      return next(system for n, system in self.systems[kind] if n == name)
    return None

  def load_plugin(self, kind, obj):
    if 'module' in obj:
      _, ext = os.path.splitext(obj['module'])
      if ext == ".py":
        return PythonPlugin(kind, obj)
      elif ext == ".so":
        return SoPlugin(kind, obj)
      else:
        print >> sys.stderr, "Invalid plugin type '%s'. Valid types are '.py' (python) and '.so' (dynamic library)" % ext
        sys.exit(-1)
    elif 'ref' in obj:
      return RefPlugin(kind, obj, obj['ref'])
    else:
      print >> sys.stderr, "Plugin type '%s' not defined. Either 'module' or 'ref' must be specified." % ext
      return None
      
  def load_plugins(self, kind): 
    for obj in get_objects(self.config, kind):
      start_time = datetime.datetime.now()

      plugin = self.load_plugin(kind, obj)
      try:    self.plugins[kind].append(plugin)
      except: self.plugins[kind] = [ plugin ]

      if plugin.__class__.__name__ != 'RefPlugin':
        instance = plugin.new_instance()
        try:    self.systems[kind].append( (plugin.name, instance) )
        except: self.systems[kind] = [ (plugin.name, instance) ]
        if 'id' in obj:
          self.refs[obj['id']] = (plugin, instance)

      elapsed_time = datetime.datetime.now() - start_time
      name = kind
      if 'id' in obj:
        name = "%s(%s)" % (kind, obj['id'])
      print >> sys.stderr, "TIME:%s loaded:%s" % (name, fmt_delta(elapsed_time))

  
  @timer('create_plugins')
  def create_plugins(self):
    self.load_plugins("source-processor")
    self.load_plugins("target-processor")
    self.load_plugins("mt")
    self.load_plugins("imt")
    self.load_plugins("aligner")
    self.load_plugins("confidencer")
    self.load_plugins("word-prioritizer")
    
    # get instances for references
    for kind, plugins in self.plugins.iteritems():
      for plugin in plugins:
        if plugin.__class__.__name__ == 'RefPlugin':
          if plugin.ref in self.refs:
            orig_plugin, instance = self.refs[plugin.ref]
            name = plugin.id if plugin.id else orig_plugin.name
            try:    self.systems[kind].append( (name, instance) )
            except: self.systems[kind] = [ (name, instance) ]
  

    print >> sys.stderr, "Plugins loaded"


  @timer('delete_plugins')
  def delete_plugins(self):
    for kind, plugins in self.plugins.iteritems():
      for plugin in plugins: del plugin
      del plugins
    print >> sys.stderr, "Plugins deleted"
    self.plugins = {}
    self.systems = {}
    self.refs = {}

  def __del__(self):
    self.delete_plugins()

  @timer('reset')
  def reset(self):
    if len(self.updates) > 0:
      self.updates = []

      for kind, plugins in self.plugins.iteritems():
        for plugin in plugins:
          if plugin.__class__.__name__ != 'RefPlugin':
            plugin.reset()

      # get instances for references
      for kind, plugins in self.plugins.iteritems():
        for plugin in plugins:
          if plugin.__class__.__name__ == 'RefPlugin':
            if plugin.ref in self.refs:
              orig_plugin, instance = self.refs[plugin.ref]
              name = plugin.id if plugin.id else orig_plugin.name
              try:    self.systems[kind].append( (name, instance) )
              except: self.systems[kind] = [ (name, instance) ]

          
    print >> sys.stderr, "Reset finished"


if __name__ == "__main__":
  models = Models(sys.argv[1])
  models.create_plugins()
  models.reset()
  models.delete_plugins()
  print >> sys.stderr, "THE END"
