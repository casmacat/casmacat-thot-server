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

#include <casmacat/Plugin.h>
#include <casmacat/IConfidenceEngine.h>
using namespace casmacat;



BOOST_PYTHON_MODULE(pycasmacat)
{
  class_<vector<string> >("vector<string>").def(vector_indexing_suite<vector<string> >() );
  class_<vector<bool> >("vector<bool>").def(vector_indexing_suite<vector<bool> >() );

  //http://www.boost.org/doc/libs/1_51_0/libs/python/doc/tutorial/doc/html/python/exposing.html
  class_<IConfidenceEngine, boost::noncopyable>("IConfidenceEngine", no_init)
            .def("getWordConfidences", &IConfidenceEngine::getWordConfidences)
            .def("getSentenceConfidence", &IConfidenceEngine::getSentenceConfidence)
            .def("getVersion", &IConfidenceEngine::getVersion)
        ;

  class_<Plugin<IConfidenceEngine>, boost::noncopyable>("PluginConfidenceEngine", init<std::string, optional<std::string, std::string, std::string> >())
                .def("create", &Plugin<IConfidenceEngine>::create, return_value_policy<manage_new_object>())
                .def("destroy", &Plugin<IConfidenceEngine>::destroy)
            ;
}
