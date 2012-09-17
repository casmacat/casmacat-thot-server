dnl Process this file with autoconf to produce a configure script.

AC_PREREQ(2.59)
AC_INIT(Casmacat Server Library, 0.1, valabau@gmail.com)
AC_CONFIG_SRCDIR([src/include/casmacat/compat.h])
AC_CONFIG_AUX_DIR([build-aux])
AC_CONFIG_HEADER([src/include/casmacat/config.h])
AC_CONFIG_MACRO_DIR([m4])

AC_CANONICAL_SYSTEM

dnl Initialize automake
AM_INIT_AUTOMAKE(casmacat, 0.1)

dnl Initialize Libtool
LT_INIT([dlopen])
LTDL_INIT

# The lt_dladvise_init symbol was added with libtool-2.2
if test "x$with_included_ltdl" != "xyes"; then
  save_CPPFLAGS="$CPPFLAGS"
  save_LDFLAGS="$LDFLAGS"
  CFLAGS="$CPPFLAGS $LTDLINCL"
  LDFLAGS="$LDFLAGS $LIBLTDL"
  AC_CHECK_LIB([ltdl], [lt_dladvise_init],
                [],
        [AC_MSG_ERROR([installed libltdl is too old])])
  LDFLAGS="$save_LDFLAGS"
  CPPFLAGS="$save_CPPFLAGS"
fi


# Checks for programs.
#AC_DISABLE_STATIC
dnl Check if Libtool is present
dnl Libtool is used for building share libraries 
AC_PROG_LIBTOOL
AC_PROG_CXX
AC_LANG(C++)
AC_PROG_INSTALL
AC_PROG_MAKE_SET
#YACC=bison
#AC_PROG_YACC
#AM_PROG_LEX


# boost
AX_BOOST_BASE(1.41)
AX_BOOST_UNIT_TEST_FRAMEWORK
AM_CONDITIONAL([MAKE_TEST], [test x"$BOOST_UNIT_TEST_FRAMEWORK_LIB" != x])

# check for Python
AM_PATH_PYTHON
AX_PYTHON_DEVEL([>= 2.5])
AM_CONDITIONAL([HAVE_PYTHON_DEVEL], [test x"$PYTHON_EXTRA_LIBS" != x])

if [ test "x$PYTHON_EXTRA_LIBS" != x ]; then
  AC_DEFINE([HAVE_PYTHON], [1], [Whether Python devel is available])
  
  # Swig python bindings
  AX_PKG_SWIG(1.3.40, [], [ AC_MSG_WARN([SWIG is required to build python bindings]) ])
  AX_SWIG_ENABLE_CXX
  AX_SWIG_PYTHON

  AM_CONDITIONAL([HAVE_SWIG], [test "x$SWIG" != x])
  
  AM_CONDITIONAL([HAVE_BOOST_PYTHON], test "x$boost_python_cpplib_avail_cv_" = xtrue)
# right now boost.python does not allow to convert non-const arguments so use SWIG instead
#  AX_BOOST_PYTHON
#
#  if [ test x$BOOST_PYTHON_LIB != x ]; then
#    AC_CACHE_CHECK(
#      [if boost_python is available],
#      [boost_python_cpplib_avail_cv_],
#      [boost_python_save_libs=$LIBS
#       LIBS="-lboost_python$BOOST_SUFFIX -lpython$PYTHON_VERSION $LIBS"
#       AC_LANG_PUSH(C++)
#       AC_LINK_IFELSE(
#         [AC_LANG_PROGRAM(
#            [[#include <boost/python.hpp>
#              using namespace boost::python;
#              class foo {};
#              BOOST_PYTHON_MODULE(samp) {
#                class_< foo > ("foo") ;
#              }]],
#            [[return 0]])],
#         [boost_python_cpplib_avail_cv_=true],
#         [boost_python_cpplib_avail_cv_=false])
#       AC_LANG_POP
#       LIBS=$boost_python_save_libs])
#  
#    if [ test x$boost_python_cpplib_avail_cv_ = xtrue ]; then
#      AC_DEFINE([HAVE_BOOST_PYTHON], [1], [Whether Boost.Python is available])
#      LIBS="-lboost_python$BOOST_SUFFIX -lpython$PYTHON_VERSION $LIBS"
#    fi
#    AM_CONDITIONAL([HAVE_BOOST_PYTHON], test x$boost_python_cpplib_avail_cv_ = xtrue)
#  fi
fi


# check perl support
# https://bitbucket.org/jjacky/rxvt-unicode-jjk/src/a815fc4b8585/configure.ac
support_perl=yes
HAS_PERL=
if test x$support_perl = xyes; then
  AC_PATH_PROG(PERL, perl5)
  AC_PATH_PROG(PERL, perl)

  AC_MSG_CHECKING(for $PERL suitability)
  if $PERL -MExtUtils::Embed >/dev/null 2>/dev/null; then

     save_CXXFLAGS="$CXXFLAGS"
     save_LIBS="$LIBS"
     CXXFLAGS="$CXXFLAGS `$PERL -MExtUtils::Embed -e ccopts`"
     LIBS="$LIBS `$PERL -MExtUtils::Embed -e ldopts`"
     AC_LINK_IFELSE([AC_LANG_PROGRAM([[
#include <EXTERN.h>
#include <perl.h>
#include <XSUB.h>
]], [[
     PerlInterpreter *perl = perl_alloc ();
]])],[rxvt_perl_link=yes],[rxvt_perl_link=no])
     CXXFLAGS="$save_CXXFLAGS"
     LIBS="$save_LIBS"

     if test x$rxvt_perl_link = xyes; then
        AC_MSG_RESULT(ok)
        AC_DEFINE(ENABLE_PERL, 1, Define if you can embed a perl interpreter)
        HAS_PERL=YES
        PERL_O=rxvtperl.o
        PERLFLAGS="`$PERL -MExtUtils::Embed -e ccopts`"
        PERLLIB="`$PERL -MExtUtils::Embed -e ldopts`"
        PERLPRIVLIBEXP="`$PERL -MConfig -e 'print $Config{privlibexp}'`"
     else
        AC_MSG_WARN([no, unable to link. Probably the libperl-dev package is missing])
     fi
  else
     AC_MSG_WARN([no working perl found, or perl not version >= 5.8])
  fi
fi
AC_SUBST(PERLLIB)
AC_SUBST(PERLFLAGS)
AC_SUBST(PERLPRIVLIBEXP)
AC_SUBST(PERL)
AC_SUBST(HAS_PERL)
AC_SUBST(PERL_O)


# doxygen
AC_CHECK_PROGS([DOXYGEN], [doxygen])
if test -z "$DOXYGEN";
   then AC_MSG_WARN([Doxygen not found - continuing without Doxygen support])
fi
AM_CONDITIONAL([HAVE_DOXYGEN],
[test -n "$DOXYGEN"])AM_COND_IF([HAVE_DOXYGEN], [AC_CONFIG_FILES([docs/doxygen.cfg])])
#DX_HTML_FEATURE(ON)
#DX_CHM_FEATURE(OFF)
#DX_CHI_FEATURE(OFF)
#DX_MAN_FEATURE(OFF)
#DX_RTF_FEATURE(OFF)
#DX_XML_FEATURE(OFF)
#DX_PDF_FEATURE(OFF)
#DX_PS_FEATURE(OFF)
#DX_INIT_DOXYGEN(casmacat, doxygen.cfg, doc)


# optional configure options
AC_ARG_WITH(debug, AC_HELP_STRING(--with-debug, \
[enable debug]), \
[ DEBUG=true \
CXXFLAGS="-g3 -O0"])

AC_ARG_WITH(gprof, AC_HELP_STRING(--with-gprof, \
[enable profiler]), \
[ PROFILE=true \
CPPFLAGS="-DDEBUG=1" \
CXXFLAGS+=" -pg"])



# Checks for libraries.
AM_PROG_LIBTOOL

dnl this allows us specify individual liking flags for each target
AM_PROG_CC_C_O 

# Checks for header files.
AC_HEADER_STDC
AC_CHECK_HEADERS([string])

# Checks for typedefs, structures, and compiler characteristics.
AC_TYPE_SIZE_T

#COMPILANCE_CXXFLAGS="${CPPCXXFLAGS} -D_POSIX_C_SOURCE=200809L"
AX_CHECK_COMPILER_FLAGS([-pedantic], [WARNING_CXXFLAGS="${WARNING_CXXFLAGS} -pedantic"])
#AX_CHECK_COMPILER_FLAGS([-fpermissive], [WARNING_CXXFLAGS="${WARNING_CXXFLAGS} -fpermissive"])
AX_CHECK_COMPILER_FLAGS([-Wall], [WARNING_CXXFLAGS="${WARNING_CXXFLAGS} -Wall"])
AX_CHECK_COMPILER_FLAGS([-Wextra], [WARNING_CXXFLAGS="${WARNING_CXXFLAGS} -Wextra"])
AX_CHECK_COMPILER_FLAGS([-Wshadow], [WARNING_CXXFLAGS="${WARNING_CXXFLAGS} -Wshadow"])
# enable this on profiling since it will show which inlines where not made
#AX_CHECK_COMPILER_FLAGS([-Winline], [WARNING_CXXFLAGS="${WARNING_CXXFLAGS} -Winline"])
AX_CHECK_COMPILER_FLAGS([-Wunused], [WARNING_CXXFLAGS="${WARNING_CXXFLAGS} -Wunused"])
AX_CHECK_COMPILER_FLAGS([-Wunused-variable], [WARNING_CXXFLAGS="${WARNING_CXXFLAGS} -Wunused-variable"])
AX_CHECK_COMPILER_FLAGS([-Wunused-parameter], [WARNING_CXXFLAGS="${WARNING_CXXFLAGS} -Wunused-parameter"])
AX_CHECK_COMPILER_FLAGS([-Wunused-function], [WARNING_CXXFLAGS="${WARNING_CXXFLAGS} -Wunused-function"])

AS_IF(test x"$DEBUG" = x"true" -o "$PROFILE" = x"true" , [WARNING_CXXFLAGS="${WARNING_CXXFLAGS} -DDEBUG -DLT_DEBUG_LOADERS"], [WARNING_CXXFLAGS="${WARNING_CXXFLAGS} -DNDEBUG"])
#AS_IF(test x"$DEBUG" = x"true", [OPTIMIZATION_CXXFLAGS="${OPTIMIZATION_CXXFLAGS} -DDEBUG -g3 -O0"], [OPTIMIZATION_CXXFLAGS="${OPTIMIZATION_CXXFLAGS} -O2 -ffast-math"])



AC_SUBST([WARNING_CXXFLAGS], ["${WARNING_CXXFLAGS}"])
AC_SUBST([COMPILANCE_CXXFLAGS])
AC_SUBST([OPTIMIZATION_CXXFLAGS])


AC_CONFIG_FILES(Makefile
                src/bin/Makefile
                src/lib/Makefile
                src/include/casmacat/Makefile
                docs/Makefile)
AC_OUTPUT
