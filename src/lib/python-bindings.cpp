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

#include <boost/python.hpp>
using namespace boost::python;

#include <casmacat/Plugin.h>
#include <casmacat/IConfidenceEngine.h>
using namespace casmacat;



char const* greet()
{
     return "hello, world";
}

class Test {
public:
  Test() {}
  Test(int size): data(size) {}
private:
  std::vector<int> data;
};

BOOST_PYTHON_MODULE(casmacat)
{
  def("greet", greet);

  class_<Test>("Test", init<>())
          .def(init<int>())
          ;

  //http://www.boost.org/doc/libs/1_51_0/libs/python/doc/tutorial/doc/html/python/exposing.html
  class_<IConfidenceEngine, boost::noncopyable>("IConfidenceEngine", no_init)
            .def("getWordConfidences", &IConfidenceEngine::getWordConfidences)
            .def("getSentenceConfidence", &IConfidenceEngine::getSentenceConfidence)
        ;

  class_<Plugin<IConfidenceEngine>, boost::noncopyable>("PluginConfidenceEngine") //, init<std::string>())
                .def("create", &Plugin<IConfidenceEngine>::create)
                .def("destroy", &Plugin<IConfidenceEngine>::destroy)
            ;
}
