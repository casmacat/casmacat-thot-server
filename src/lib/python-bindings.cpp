/*
 *   Copyright 2012, valabau
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 * 
 * python-bindings.cpp
 *
 *  Created on: 06/09/2012
 *      Author: valabau
 */




#include <string>
#include <vector>
using namespace std;

#include <boost/python.hpp>
#include <boost/python/suite/indexing/vector_indexing_suite.hpp>
using namespace boost::python;
using namespace boost::python::converter;

#include <casmacat/Plugin.h>
#include <casmacat/IConfidenceEngine.h>
using namespace casmacat;


template<typename T>
struct vector_to_python_list
{
  static PyObject* convert(const vector<T> &v) {
    using boost::python::list;
    list l;
    typename vector<T>::const_iterator p;
    for(p=v.begin();p!=v.end();++p){
      l.append(object(*p));
    }
    return incref(l.ptr());
  }
};

template<typename T>
struct vector_from_python_list {

    vector_from_python_list() {
      registry::push_back(&vector_from_python_list<T>::convertible,
        &vector_from_python_list<T>::construct,
        type_id<std::vector<T> >());
    }

    // Determine if obj_ptr can be converted in a std::vector<T>
    static void* convertible(PyObject* obj_ptr) {
      if (!PyList_Check(obj_ptr)) return 0;
      return obj_ptr;
    }

    // Convert obj_ptr into a std::vector<T>
    static void construct(PyObject* obj_ptr, rvalue_from_python_stage1_data* data) {
      // Extract the character data from the python string
      // const char* value = PyString_AsString(obj_ptr);
      list l(handle<>(borrowed(obj_ptr)));

      // // Verify that obj_ptr is a string (should be ensured by convertible())
      // assert(value);

      // Grab pointer to memory into which to construct the new std::vector<T>
      void* storage = ((rvalue_from_python_storage<std::vector<T> >*)data)->storage.bytes;

      // in-place construct the new std::vector<T> using the character data
      // extraced from the python object
      vector<T>& v = *(new (storage) vector<T>());

      // populate the vector from list contains !!!
      int le = len(l);
      v.resize(le);
      for(int i = 0;i!=le;++i) {
        v[i] = extract<T>(l[i]);
      }

      // Stash the memory chunk pointer for later use by boost.python
      data->convertible = storage;
    }
};

size_t countV(const vector<string>& v) {
  return v.size();
}

void addV(vector<string>& v) {
  v.push_back("kk");
}

vector<string> genranvec() {
  return vector<string>(3, "aa");
}

//http://www.boost.org/doc/libs/1_51_0/libs/python/doc/tutorial/doc/html/python/exposing.html
BOOST_PYTHON_MODULE(pycasmacat)
{
  // register the to-from-python converters for rvalues (const values)
  to_python_converter< vector<string>, vector_to_python_list<string> >();
  vector_from_python_list<string>();
  to_python_converter< vector<bool>, vector_to_python_list<bool> >();
  vector_from_python_list<bool>();

  // register the to-from-python converters for lvalues (non const values)
  class_<vector<string> >("VectorOfStrings").def(vector_indexing_suite<vector<string> >() );
  class_<vector<bool> >("VectorOfBools").def(vector_indexing_suite<vector<bool> >() );

  def("countV", countV);
  def("genranvec", genranvec);
  def("addV", addV);



  // Plugin loader that acts as a Factory
  class_<Plugin<IConfidenceEngine>, boost::noncopyable>("PluginConfidenceEngine", init<std::string, optional<std::string, std::string, std::string> >())
                .def("create", &Plugin<IConfidenceEngine>::create, return_value_policy<manage_new_object>())
                .def("destroy", &Plugin<IConfidenceEngine>::destroy)
            ;

  // Class interface
  class_<IConfidenceEngine, boost::noncopyable>("IConfidenceEngine", no_init)
            .def("getWordConfidences", &IConfidenceEngine::getWordConfidences)
            .def("getSentenceConfidence", &IConfidenceEngine::getSentenceConfidence)
            .def("getVersion", &IConfidenceEngine::getVersion)
        ;

}
